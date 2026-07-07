'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { performTenPull, performSinglePull } from '@/lib/gachaLogic';
import { fetchGachaStatus } from '@/lib/api';
import { Sparkles, RotateCcw, User, AlertCircle } from 'lucide-react';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import { getImageUrl } from '@/components/planner/utils';

interface GachaResult {
  name: string;
  rarity: 1 | 2 | 3;
  isPickup: boolean;
  isNew?: boolean;
}

const ENCORE_STUDENTS = [
  "아즈사(수영복)", "마시로(수영복)", "히나(수영복)", "이오리(수영복)", 
  "네루(바니걸)", "카린(바니걸)", "아루(새해)", "무츠키(새해)", 
  "이즈나(수영복)", "치세(수영복)"
];

export default function GachaPage() {
  const [gachaData, setGachaData] = useState<any>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [results, setResults] = useState<GachaResult[]>([]);
  const [pullHistory, setPullHistory] = useState<GachaResult[]>([]);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [masterDataMap, setMasterDataMap] = useState<Record<string, StudentMaster>>({});
  const [encoreTarget, setEncoreTarget] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const [{ masterData }, gachaStatus] = await Promise.all([
        getCachedServerData(),
        fetchGachaStatus().catch(() => null)
      ]);
      
      if (cancelled) return;

      const map: Record<string, StudentMaster> = {};
      masterData.forEach(student => {
        const normalizedName = student.name.replace(/\s+/g, '');
        map[normalizedName] = student;
      });
      setMasterDataMap(map);

      if (gachaStatus) {
        // 백엔드 캐시 오류 대응: 3성 풀에서 '앙코르 모집!' 등의 잘못된 이름 제거
        if (gachaStatus.pools && gachaStatus.pools["3_star"]) {
          gachaStatus.pools["3_star"] = gachaStatus.pools["3_star"].filter(
            (name: string) => !name.includes('앙코르 모집')
          );
        }
        setGachaData(gachaStatus);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  const banner = gachaData?.banners?.[activeBannerIndex] || gachaData?.banners?.[0];
  const isEncore = banner?.name.includes('앙코르 모집');

  const handlePull = (type: 'single' | 'ten') => {
    if (!gachaData || !banner) return;
    if (isEncore && !encoreTarget) {
      alert('앙코르 모집의 픽업 대상을 선택해주세요.');
      return;
    }

    const pullResults = type === 'single' 
      ? performSinglePull(gachaData, activeBannerIndex, encoreTarget) 
      : performTenPull(gachaData, activeBannerIndex, encoreTarget);
    
    setPullHistory(prev => {
      const historyNames = new Set(prev.map(p => p.name));
      const finalResults = pullResults.map(r => ({
          ...r,
          isNew: !historyNames.has(r.name)
      }));
      setResults(finalResults);
      return [...prev, ...finalResults];
    });
    setShowResultScreen(true);
  };

  const handleReset = () => {
    setResults([]);
    setPullHistory([]);
    setShowResultScreen(false);
  };

  const inventorySummary = useMemo(() => {
    const summary: Record<string, { count: number; rarity: number; isPickup: boolean }> = {};
    pullHistory.forEach(r => {
      if (!summary[r.name]) {
        summary[r.name] = { count: 0, rarity: r.rarity, isPickup: r.isPickup };
      }
      summary[r.name].count += 1;
    });

    const sorted = Object.entries(summary).sort((a, b) => {
      if (a[1].isPickup && !b[1].isPickup) return -1;
      if (!a[1].isPickup && b[1].isPickup) return 1;
      if (b[1].rarity !== a[1].rarity) return b[1].rarity - a[1].rarity;
      return b[1].count - a[1].count;
    });
    return sorted;
  }, [pullHistory]);

  const getCardStyle = (rarity: number) => {
    if (rarity === 3) return 'border-[#ff8ac8] bg-[#ff8ac8] shadow-[0_0_20px_rgba(255,138,200,0.8)]';
    if (rarity === 2) return 'border-[#f2cd5c] bg-[#f2cd5c] shadow-[0_0_15px_rgba(242,205,92,0.8)]';
    return 'border-[#b0b6c0] bg-[#b0b6c0]';
  };

  const getStarColor = (rarity: number) => {
    return 'text-[#fadb5b]'; // All stars are yellow in the result screen
  };

  if (!gachaData) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center justify-center text-slate-500">
          <Sparkles className="animate-pulse mb-4 text-[var(--plana-primary)]" size={48} />
          <p className="font-bold">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 text-slate-700 font-sans p-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <Sparkles className="text-[var(--plana-primary)]" /> 가챠 시뮬레이터
          </h1>
          <div className="text-sm font-bold bg-white px-4 py-2 rounded-full border border-slate-200 shadow-inner">
            누적 모집: <span className="text-[var(--plana-primary)] text-lg ml-1">{pullHistory.length}</span> 회
          </div>
        </div>
        
        {/* Banner Tabs */}
        {gachaData.banners && gachaData.banners.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
            {gachaData.banners.map((b: any, idx: number) => (
              <button
                key={b.id}
                onClick={() => {
                  setActiveBannerIndex(idx);
                  setResults([]); // Clear results when switching banners to avoid confusion
                  setEncoreTarget('');
                }}
                className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-300 ${
                  activeBannerIndex === idx 
                    ? 'bg-[var(--plana-primary)] text-white shadow-[0_0_15px_rgba(255,105,180,0.4)] border border-pink-400'
                    : 'bg-white text-slate-500 hover:text-[var(--plana-primary)] hover:bg-pink-50 border border-slate-200'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* Main Gacha Area */}
        <div className="relative bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl mb-8 overflow-hidden min-h-[500px] flex flex-col">
          {/* Background decoration */}
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--plana-primary)]/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-600/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 flex-1 flex flex-col">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm mb-2">{banner?.name}</h2>
              {isEncore ? (
                <p className="text-slate-500 text-sm">확률 - 3★: 3.0% (선택 픽업 0.7%) | 2★: 18.5% | 1★: 78.5%</p>
              ) : (
                <p className="text-slate-500 text-sm">확률 - 3★: 3.0% (픽업 {(banner?.pickups?.reduce((s: number, p: any) => s + p.rate * 100, 0) || 0).toFixed(1)}%) | 2★: 18.5% | 1★: 78.5%</p>
              )}
            </div>

            {results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center transition-opacity duration-300 opacity-100 scale-100">
                
                {isEncore && (
                  <div className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner max-w-2xl w-full">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-center gap-2">
                      <Sparkles className="text-pink-500" size={20} />
                      앙코르 픽업 대상을 선택하세요
                    </h3>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {ENCORE_STUDENTS.map(studentName => (
                        <button
                          key={studentName}
                          onClick={() => setEncoreTarget(studentName)}
                          className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                            encoreTarget === studentName
                            ? 'bg-pink-100 border-pink-400 text-pink-600 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300 hover:bg-pink-50'
                          }`}
                        >
                          {studentName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center justify-center text-slate-500 min-h-[100px]">
                  {(!isEncore || encoreTarget) ? (
                    <>
                      <Sparkles size={48} className="opacity-20 mb-4 text-[var(--plana-primary)]" />
                      <p className="font-bold">모집 버튼을 눌러주세요</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={48} className="opacity-20 mb-4 text-orange-400" />
                      <p className="font-bold text-orange-500">모집을 시작하려면 픽업 대상을 선택해야 합니다.</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-300">
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="grid grid-cols-5 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 w-fit mx-auto">
                    {results.map((r, idx) => {
                      const normalizedName = r.name.replace(/\s+/g, '');
                      const student = masterDataMap[normalizedName];
                      const isNew = r.isNew;
                      return (
                        <div 
                          key={idx} 
                          className={`relative w-[64px] h-[78px] sm:w-[90px] sm:h-[110px] md:w-[110px] md:h-[134px] rounded-lg border-[3px] flex flex-col justify-between overflow-visible transition-transform hover:-translate-y-1 -skew-x-[6deg] ${getCardStyle(r.rarity)}`}
                          style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                          {/* New Tag */}
                          {isNew && (
                            <div 
                              className="absolute -top-3 -left-3 md:-top-4 md:-left-4 z-20 text-[#fff200] font-black text-sm md:text-xl italic drop-shadow-[0_0_5px_rgba(255,242,0,0.8)] z-30 skew-x-[6deg]" 
                              style={{ WebkitTextStroke: '1px #a46b00' }}
                            >
                              New
                            </div>
                          )}

                          {/* Portrait */}
                          <div className="absolute inset-0 z-0 bg-slate-200 overflow-hidden rounded-md">
                            {student && student.portraitUrls && student.portraitUrls.length > 0 ? (
                              <img src={getImageUrl(student.portraitUrls[0])} alt={r.name} className="w-full h-full object-cover object-top skew-x-[6deg] scale-110" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center skew-x-[6deg]">
                                <User size={32} className="text-slate-400 opacity-50" />
                                <span className="text-[10px] font-bold text-slate-500 mt-1 truncate w-full text-center px-1">{r.name}</span>
                              </div>
                            )}
                          </div>

                          <div className="relative z-10 flex-1"></div>

                          {/* Stars Bottom Bar */}
                          <div className="relative z-10 h-[18px] md:h-[22px] bg-[#394251] flex justify-center items-center rounded-b-[4px]">
                            <div className={`flex items-center gap-[1px] md:gap-0.5 text-[10px] md:text-sm drop-shadow-md skew-x-[6deg] ${getStarColor(r.rarity)}`}>
                              {'★'.repeat(r.rarity)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-between items-end mt-12">
              <div className="flex items-center">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors border border-slate-200 shadow-sm"
                  title="초기화"
                >
                  <RotateCcw size={18} />
                  초기화
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePull('single')}
                  disabled={isEncore && !encoreTarget}
                  className="px-8 py-3 bg-slate-500 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors border border-slate-400 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  1회 모집
                </button>
                <button
                  onClick={() => handlePull('ten')}
                  disabled={isEncore && !encoreTarget}
                  className="px-8 py-3 bg-[var(--plana-primary)] hover:bg-pink-400 text-white font-black rounded-xl transition-all shadow-[0_0_20px_rgba(255,105,180,0.3)] hover:shadow-[0_0_25px_rgba(255,105,180,0.5)] border border-pink-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {results.length > 0 ? '10회 더 모집' : '10회 모집'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Summary */}
        {pullHistory.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
            <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2">
              <span className="text-[var(--plana-primary)]">📊</span> 획득 기록 요약
            </h3>
            <div className="flex flex-wrap gap-3">
              {inventorySummary.map(([name, data]) => {
                const normalizedName = name.replace(/\s+/g, '');
                const student = masterDataMap[normalizedName];
                return (
                <div 
                  key={name} 
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-xl border ${
                    data.isPickup ? 'bg-pink-100 border-pink-300 text-pink-600' :
                    data.rarity === 3 ? 'bg-pink-50 border-pink-200 text-pink-500' :
                    data.rarity === 2 ? 'bg-white border-yellow-300 text-slate-700' :
                    'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-current shadow-sm flex-shrink-0 bg-white/80 flex items-center justify-center">
                    {student && student.portraitUrls && student.portraitUrls.length > 0 ? (
                      <img src={getImageUrl(student.portraitUrls[0])} alt={name} className="w-full h-full object-cover object-top" />
                    ) : (
                      <User size={16} className="text-slate-400 opacity-50" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] opacity-70 mb-0.5">{data.isPickup ? 'PICKUP' : '★'.repeat(data.rarity)}</span>
                    <span className="font-bold text-sm leading-normal whitespace-nowrap">{name}</span>
                  </div>
                  <div className="h-6 w-px bg-current opacity-20" />
                  <span className="font-black text-lg">x{data.count}</span>
                </div>
              )})}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
