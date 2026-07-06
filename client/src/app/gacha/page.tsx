'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { performTenPull, performSinglePull } from '@/lib/gachaLogic';
import gachaData from '@/data/gacha.json';
import { Sparkles, RotateCcw, User } from 'lucide-react';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import { getImageUrl } from '@/components/planner/utils';

interface GachaResult {
  name: string;
  rarity: 1 | 2 | 3;
  isPickup: boolean;
  isNew?: boolean;
}

export default function GachaPage() {
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [results, setResults] = useState<GachaResult[]>([]);
  const [pullHistory, setPullHistory] = useState<GachaResult[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [masterDataMap, setMasterDataMap] = useState<Record<string, StudentMaster>>({});
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMasterData() {
      const { masterData } = await getCachedServerData();
      if (cancelled) return;
      const map: Record<string, StudentMaster> = {};
      masterData.forEach(student => {
        const normalizedName = student.name.replace(/\s+/g, '');
        map[normalizedName] = student;
      });
      setMasterDataMap(map);
    }
    loadMasterData();
    return () => { cancelled = true; };
  }, []);

  const banner = gachaData.banners[activeBannerIndex] || gachaData.banners[0];

  const handlePull = (type: 'single' | 'ten') => {
    setIsAnimating(true);
    animTimerRef.current = setTimeout(() => {
      const pullResults = type === 'single' ? performSinglePull(activeBannerIndex) : performTenPull(activeBannerIndex);
      
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
      setIsAnimating(false);
    }, 400); // simulate animation delay
  };

  const handleReset = () => {
    setResults([]);
    setPullHistory([]);
    setShowResultScreen(false);
  };

  const handleConfirm = () => {
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

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 text-slate-700 font-sans p-6 slide-in-right-anim">
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
            {gachaData.banners.map((b, idx) => (
              <button
                key={b.id}
                onClick={() => {
                  setActiveBannerIndex(idx);
                  setResults([]); // Clear results when switching banners to avoid confusion
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
        <div className={`relative rounded-3xl shadow-2xl mb-8 overflow-hidden min-h-[500px] flex flex-col transition-colors duration-500 ${showResultScreen ? 'bg-gradient-to-br from-[#e0f2fe] via-[#f0f9ff] to-[#bae6fd] p-0' : 'bg-white border border-slate-200 p-8'}`}>
          {!showResultScreen ? (
            <>
              {/* Background decoration for banner mode */}
              <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--plana-primary)]/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-600/10 blur-[100px] rounded-full pointer-events-none" />

              <div className="relative z-10 flex-1 flex flex-col">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm mb-2">{banner.name}</h2>
                  <p className="text-slate-500 text-sm">확률 - 3★: 3.0% (픽업 {banner.pickups.reduce((s, p) => s + p.rate * 100, 0).toFixed(1)}%) | 2★: 18.5% | 1★: 78.5%</p>
                </div>

                {/* Banner Content (Empty state) */}
                <div className={`flex-1 flex items-center justify-center transition-opacity duration-300 ${isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
                  <div className="flex flex-col items-center justify-center text-slate-500 h-full min-h-[200px]">
                    <Sparkles size={48} className="opacity-20 mb-4 text-[var(--plana-primary)]" />
                    <p className="font-bold">모집 버튼을 눌러주세요</p>
                  </div>
                </div>

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
                      disabled={isAnimating}
                      className="px-8 py-3 bg-slate-500 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors border border-slate-400 shadow-lg disabled:opacity-50"
                    >
                      1회 모집
                    </button>
                    <button
                      onClick={() => handlePull('ten')}
                      disabled={isAnimating}
                      className="px-8 py-3 bg-[var(--plana-primary)] hover:bg-pink-400 text-white font-black rounded-xl transition-all shadow-[0_0_20px_rgba(255,105,180,0.3)] hover:shadow-[0_0_25px_rgba(255,105,180,0.5)] border border-pink-400 disabled:opacity-50"
                    >
                      10회 모집
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Result Screen */
            <div className={`relative w-full h-full min-h-[500px] flex flex-col animate-in fade-in zoom-in-95 duration-300`}>
              {/* Geometric pattern overlay (optional, subtle) */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              
              <div className="flex-1 flex items-center justify-center pt-12 pb-4">
                <div className="grid grid-cols-5 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 w-fit mx-auto">
                  {results.map((r, idx) => {
                    const normalizedName = r.name.replace(/\s+/g, '');
                    const student = masterDataMap[normalizedName];
                    const isNew = r.isNew;
                    return (
                      <div 
                        key={idx} 
                        className={`relative w-[64px] h-[78px] sm:w-[90px] sm:h-[110px] md:w-[110px] md:h-[134px] rounded-sm border-[3px] flex flex-col justify-between overflow-visible transition-transform hover:scale-105 ${getCardStyle(r.rarity)}`}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        {/* New Tag */}
                        {isNew && (
                          <div 
                            className="absolute -top-3 -left-3 md:-top-4 md:-left-4 z-20 text-[#fff200] font-black text-sm md:text-xl italic drop-shadow-[0_0_5px_rgba(255,242,0,0.8)] z-30" 
                            style={{ WebkitTextStroke: '1px #a46b00' }}
                          >
                            New
                          </div>
                        )}

                        {/* Portrait */}
                        <div className="absolute inset-0 z-0 bg-slate-200 overflow-hidden">
                          {student && student.portraitUrls && student.portraitUrls.length > 0 ? (
                            <img src={getImageUrl(student.portraitUrls[0])} alt={r.name} className="w-full h-full object-cover object-top" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <User size={32} className="text-slate-400 opacity-50" />
                              <span className="text-[10px] font-bold text-slate-500 mt-1 truncate w-full text-center px-1">{r.name}</span>
                            </div>
                          )}
                        </div>

                        <div className="relative z-10 flex-1"></div>

                        {/* Stars Bottom Bar */}
                        <div className="relative z-10 h-[18px] md:h-[22px] bg-[#394251] flex justify-center items-center">
                          <div className={`flex items-center gap-[1px] md:gap-0.5 text-[10px] md:text-sm drop-shadow-md ${getStarColor(r.rarity)}`}>
                            {'★'.repeat(r.rarity)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bottom Confirm Area */}
              <div className="relative w-full p-6 mt-4 flex justify-center items-center">
                <button
                  onClick={handleConfirm}
                  className="px-16 py-3 md:py-4 bg-[#70c6fb] hover:bg-[#5bb8f0] text-white text-lg md:text-xl font-bold rounded shadow-md transition-colors"
                >
                  확인
                </button>

                {/* Recruitment Points */}
                <div className="absolute right-6 bottom-6 flex flex-col items-end hidden md:flex">
                  <div className="bg-white border border-slate-200 shadow-sm flex items-center divide-x divide-slate-200 rounded-sm overflow-hidden">
                    <div className="px-3 py-1 bg-slate-50 flex items-center gap-1">
                      <span className="text-[#3db4f9] font-black italic text-sm">Point</span>
                      <span className="text-slate-600 text-xs font-bold whitespace-nowrap">모집 포인트</span>
                    </div>
                    <div className="px-4 py-1 bg-[#284a73] text-white font-bold min-w-[50px] text-center">
                      {pullHistory.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                  className={`relative overflow-hidden flex items-center gap-3 px-4 py-2 rounded-xl border ${
                    data.isPickup ? 'bg-pink-100 border-pink-300 text-pink-600' :
                    data.rarity === 3 ? 'bg-pink-50 border-pink-200 text-pink-500' :
                    data.rarity === 2 ? 'bg-white border-yellow-300 text-slate-700' :
                    'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {student && student.portraitUrls && student.portraitUrls.length > 0 ? (
                    <div className="absolute inset-0 overflow-hidden pt-8 md:pt-16 px-4 md:px-8 pointer-events-none opacity-20">
                      <img src={getImageUrl(student.portraitUrls[0])} alt={name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-current shadow-sm flex-shrink-0 bg-white/50 flex items-center justify-center">
                      <User size={16} className="text-slate-400 opacity-50" />
                    </div>
                  )}
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
