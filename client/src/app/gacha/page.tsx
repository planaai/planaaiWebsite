'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { performTenPull, performSinglePull } from '@/lib/gachaLogic';
import gachaData from '@/data/gacha.json';
import { Sparkles, RotateCcw } from 'lucide-react';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import { getImageUrl } from '@/components/planner/utils';

interface GachaResult {
  name: string;
  rarity: 1 | 2 | 3;
  isPickup: boolean;
}

export default function GachaPage() {
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [results, setResults] = useState<GachaResult[]>([]);
  const [pullHistory, setPullHistory] = useState<GachaResult[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
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
      setResults(pullResults);
      setPullHistory(prev => [...prev, ...pullResults]);
      setIsAnimating(false);
    }, 400); // simulate animation delay
  };

  const handleReset = () => {
    setResults([]);
    setPullHistory([]);
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

  const getRarityStyle = (rarity: number, isPickup: boolean) => {
    if (isPickup) return 'bg-pink-50 border-pink-300 shadow-sm text-pink-500';
    if (rarity === 3) return 'bg-pink-50/50 border-pink-200 shadow-sm text-pink-500';
    if (rarity === 2) return 'bg-white border-yellow-300 text-yellow-600 shadow-sm';
    return 'bg-slate-50 border-slate-200 text-slate-600 shadow-sm';
  };

  const getStarColor = (rarity: number) => {
    if (rarity === 3) return 'text-pink-400';
    if (rarity === 2) return 'text-yellow-600';
    return 'text-slate-500';
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
        <div className="relative bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl mb-8 overflow-hidden min-h-[400px] flex flex-col">
          {/* Background decoration */}
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--plana-primary)]/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-600/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 flex-1 flex flex-col">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm mb-2">{banner.name}</h2>
              <p className="text-slate-500 text-sm">확률 - 3★: 3.0% (픽업 {banner.pickups.reduce((s, p) => s + p.rate * 100, 0).toFixed(1)}%) | 2★: 18.5% | 1★: 78.5%</p>
            </div>

            {/* Results Grid */}
            <div className={`flex-1 flex items-center justify-center transition-opacity duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
              {results.length > 0 ? (
                <div className="grid grid-cols-5 gap-4 w-full max-w-[900px] mx-auto">
                  {results.map((r, idx) => {
                    const normalizedName = r.name.replace(/\s+/g, '');
                    const student = masterDataMap[normalizedName];
                    return (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-2xl flex flex-col items-center justify-center text-center h-32 backdrop-blur-sm border transition-transform hover:scale-105 ${getRarityStyle(r.rarity, r.isPickup)}`}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      {student && student.portraitUrl && (
                        <div className="w-10 h-10 mb-1 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0 bg-slate-200">
                          <img src={getImageUrl(student.portraitUrl)} alt={r.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="font-black tracking-wide text-xs mb-1 leading-tight line-clamp-1 w-full">
                        {r.name}
                      </div>
                      <div className={`text-sm mb-1 drop-shadow-sm ${getStarColor(r.rarity)}`}>
                        {'★'.repeat(r.rarity)}
                      </div>
                      {r.isPickup && (
                        <div className="text-[10px] bg-pink-500 text-white px-2 py-0.5 rounded-full mt-auto font-bold shadow-sm border border-pink-400 animate-pulse">
                          PICK UP!
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 h-full min-h-[200px]">
                  <Sparkles size={48} className="opacity-20 mb-4" />
                  <p className="font-bold">모집 버튼을 눌러주세요</p>
                </div>
              )}
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
                  className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${
                    data.isPickup ? 'bg-pink-100 border-pink-300 text-pink-600' :
                    data.rarity === 3 ? 'bg-pink-50 border-pink-200 text-pink-500' :
                    data.rarity === 2 ? 'bg-white border-yellow-300 text-slate-700' :
                    'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {student && student.portraitUrl ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-current shadow-sm flex-shrink-0 bg-white/50">
                      <img src={getImageUrl(student.portraitUrl)} alt={name} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <div className="flex flex-col">
                    <span className="text-[10px] opacity-70 mb-0.5">{data.isPickup ? 'PICKUP' : '★'.repeat(data.rarity)}</span>
                    <span className="font-bold text-sm leading-none whitespace-nowrap">{name}</span>
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
