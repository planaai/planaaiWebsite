'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  RotateCcw,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { getImageUrl } from '@/components/planner/utils';
import { useGacha } from '@/hooks/useGacha';
import type { GachaBanner, GachaPickup } from '@/lib/gachaLogic';
import kusoaronaImg from './kusoarona.png';

function BrickWallIcon({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M8 3v6" />
      <path d="M16 3v6" />
      <path d="M12 9v6" />
      <path d="M8 15v6" />
      <path d="M16 15v6" />
    </svg>
  );
}

const ENCORE_STUDENTS = [
  '아즈사(수영복)', '마시로(수영복)', '히나(수영복)', '이오리(수영복)',
  '네루(바니걸)', '카린(바니걸)', '아루(새해)', '무츠키(새해)',
  '이즈나(수영복)', '치세(수영복)',
];

export default function GachaPage() {
  const {
    gachaData,
    activeBannerIndex,
    setActiveBannerIndex,
    results,
    setResults,
    pullHistory,
    masterDataMap,
    encoreTarget,
    setEncoreTarget,
    banner,
    isEncore,
    chargeType,
    currentChargeStack,
    handlePull,
    handleResetHistory,
    handleResetStacks,
    inventorySummary,
  } = useGacha();

  const [isFold1StarOpen, setIsFold1StarOpen] = useState(false);

  const isLimited = chargeType === 'limited';

  // Memoized SESSION statistics derived purely from pullHistory and inventorySummary
  const sessionStats = useMemo(() => {
    const totalPulls = pullHistory.length;
    const pyroxeneConsumed = totalPulls * 120;
    let count3 = 0;
    let count2 = 0;
    let count1 = 0;
    let pickupCount = 0;

    for (let i = 0; i < pullHistory.length; i++) {
      const item = pullHistory[i];
      if (item.rarity === 3) count3++;
      else if (item.rarity === 2) count2++;
      else if (item.rarity === 1) count1++;
      if (item.isPickup) pickupCount++;
    }

    const rate3 = totalPulls > 0 ? ((count3 / totalPulls) * 100).toFixed(1) : '0.0';
    const sessionPad = String(totalPulls).padStart(4, '0');

    return {
      totalPulls,
      pyroxeneConsumed,
      count3,
      count2,
      count1,
      pickupCount,
      rate3,
      sessionPad,
    };
  }, [pullHistory]);

  // Aggregate pickup probability
  const totalPickupRate = useMemo(() => {
    if (isEncore) return '0.7';
    const sum = banner?.pickups?.reduce((acc: number, p: GachaPickup) => {
      const rateVal = p.rate !== undefined ? p.rate * 100 : (p.probability || 0);
      return acc + rateVal;
    }, 0) || 0;
    return sum.toFixed(1);
  }, [banner, isEncore]);

  // Base probability derivation with default fallbacks
  const baseRates = useMemo(() => {
    const normal = gachaData?.rates?.normal;
    const r3 = normal?.['3_star'] !== undefined ? (normal['3_star'] * 100).toFixed(1) : '3.0';
    const r2 = normal?.['2_star'] !== undefined ? (normal['2_star'] * 100).toFixed(1) : '18.5';
    const r1 = normal?.['1_star'] !== undefined ? (normal['1_star'] * 100).toFixed(1) : '78.5';
    return { r3, r2, r1 };
  }, [gachaData?.rates?.normal]);

  // Separate inventory summary into high priority (3★, 2★, or pickup) and 1★
  const { highPriorityItems, oneStarItems } = useMemo(() => {
    const high: typeof inventorySummary = [];
    const oneStar: typeof inventorySummary = [];

    for (let i = 0; i < inventorySummary.length; i++) {
      const entry = inventorySummary[i];
      const [, data] = entry;
      if (data.isPickup || data.rarity >= 2) {
        high.push(entry);
      } else {
        oneStar.push(entry);
      }
    }

    return { highPriorityItems: high, oneStarItems: oneStar };
  }, [inventorySummary]);

  // High-fidelity terminal skeleton loading state
  if (!gachaData) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-transparent text-slate-700 font-sans p-2.5 sm:p-4">
        <div className="max-w-[1100px] mx-auto space-y-3.5 animate-pulse">
          {/* Skeleton Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-[var(--plana-border)]">
            <div className="space-y-1">
              <div className="h-2.5 w-24 bg-pink-100 rounded-xs" />
              <div className="h-6 w-48 bg-pink-200/60 rounded-xs" />
            </div>
            <div className="h-7 w-36 bg-pink-100/60 rounded-xs" />
          </div>

          {/* Skeleton Tabs */}
          <div className="flex gap-2">
            <div className="h-7 w-28 bg-white/80 rounded-xs border border-[var(--plana-border)]" />
            <div className="h-7 w-32 bg-white/80 rounded-xs border border-[var(--plana-border)]" />
            <div className="h-7 w-24 bg-white/80 rounded-xs border border-[var(--plana-border)]" />
          </div>

          {/* Skeleton Bento Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            <div className="md:col-span-8 h-[380px] bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs shadow-xs" />
            <div className="md:col-span-4 space-y-3.5">
              <div className="h-[210px] bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs shadow-xs" />
              <div className="h-[156px] bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs shadow-xs" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate 20-segment gauge parameters
  const filledSegments = Math.min(Math.floor(currentChargeStack / 10), 20);
  const isCapReached = currentChargeStack >= 200;
  const isMidpointReached = currentChargeStack >= 100;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-transparent text-slate-700 font-sans p-2.5 sm:p-4 pb-24 sm:pb-6">
      <div className="max-w-[1100px] mx-auto space-y-3.5">

        {/* 1. Technical Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[var(--plana-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-6 bg-gradient-to-b from-[var(--plana-primary)] to-[var(--plana-primary-dark)] rounded-xs shadow-xs" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--plana-primary-dark)] leading-none">
                RECRUIT TERMINAL
              </div>
              <h1 className="text-lg sm:text-xl font-bold font-title-v text-slate-900 tracking-tight leading-tight mt-0.5">
                모의 모집 시뮬레이터
              </h1>
            </div>
          </div>

          {/* Derived Session Telemetry Status */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs shadow-xs text-xs font-mono tabular-nums">
              <span className="text-slate-400 font-bold tracking-wider text-[10px]">SESSION</span>
              <span className="font-bold text-slate-900">{sessionStats.sessionPad}</span>
              <span className="w-px h-3 bg-[var(--plana-border)]" />
              <span className="text-slate-400 font-bold text-[10px]">청휘석</span>
              <span className="font-bold text-[var(--plana-primary-dark)]">{sessionStats.pyroxeneConsumed.toLocaleString()}</span>
            </div>
          </div>
        </header>

        {/* 2. Banner Selection Tabs */}
        {gachaData.banners && gachaData.banners.length > 1 && (
          <nav aria-label="모집 배너 선택" className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {gachaData.banners.map((b: GachaBanner, idx: number) => {
              const active = activeBannerIndex === idx;
              const isBannerLimited = b.name?.includes('[한정]') || b.name?.includes('페스');
              return (
                <button
                  key={b.id || idx}
                  type="button"
                  onClick={() => {
                    setActiveBannerIndex(idx);
                    setResults([]);
                    setEncoreTarget('');
                  }}
                  className={`group relative px-3.5 py-1.5 rounded-xs font-bold text-xs whitespace-nowrap transition-all duration-200 flex items-center gap-2 border ${
                    active
                      ? 'bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-primary-dark)] text-white border-[var(--plana-primary-dark)] shadow-sm shadow-pink-200/50'
                      : 'bg-white/80 backdrop-blur-md text-slate-600 hover:text-[var(--plana-primary-dark)] hover:bg-white border-[var(--plana-border)] shadow-xs'
                  }`}
                >
                  <span>{b.name || `픽업 모집 #${idx + 1}`}</span>
                  {isBannerLimited && (
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded-xs uppercase tracking-wider ${
                        active ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      LIMITED
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-white/70 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* 3. Asymmetric Bento Grid (Stage col-span-8 / Telemetry col-span-4) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">

          {/* STAGE: Result & Empty Slots Area (col-span-8) */}
          <section className="md:col-span-8 flex flex-col justify-between relative bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs p-3.5 sm:p-4 shadow-xs min-h-[380px] bg-[radial-gradient(rgba(255,166,201,0.25)_1px,transparent_1px)] [background-size:16px_16px]">
            <div>
              {/* Stage Header: Banner Title & Probability Chips */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--plana-border)]/60">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--plana-primary-dark)]">
                    TARGET RECRUIT
                  </div>
                  <h2 className="text-base sm:text-lg font-bold font-title-v text-slate-900 tracking-tight leading-tight">
                    {banner?.name || '픽업 모집'}
                  </h2>
                </div>

                {/* Probability Chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums">
                  <span className="px-2 py-0.5 bg-rose-50 border border-rose-300 text-rose-600 font-bold rounded-xs">
                    3★ {baseRates.r3}%
                  </span>
                  <span className="px-2 py-0.5 bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-primary-dark)] text-white font-bold rounded-xs shadow-2xs">
                    PICKUP {totalPickupRate}%
                  </span>
                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-700 font-bold rounded-xs">
                    2★ {baseRates.r2}%
                  </span>
                  <span className="px-2 py-0.5 bg-white/80 border border-[var(--plana-border)]/60 text-slate-600 font-medium rounded-xs">
                    1★ {baseRates.r1}%
                  </span>
                </div>
              </div>

              {/* Encore Student Selection Grid (if Encore Banner) */}
              {isEncore && (
                <div className="mt-3 p-3 bg-white/80 backdrop-blur-sm border border-[var(--plana-border)] rounded-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-[var(--plana-primary-dark)]" />
                      앙코르 픽업 대상 지정
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {encoreTarget ? `선택: ${encoreTarget}` : '미지정'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ENCORE_STUDENTS.map((studentName) => {
                      const isSelected = encoreTarget === studentName;
                      return (
                        <button
                          key={studentName}
                          type="button"
                          onClick={() => setEncoreTarget(studentName)}
                          className={`px-2.5 py-1 text-xs font-bold transition-all duration-150 rounded-xs border -skew-x-6 ${
                            isSelected
                              ? 'bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-primary-dark)] border-[var(--plana-primary-dark)] text-white shadow-2xs'
                              : 'bg-white/90 border-[var(--plana-border)] text-slate-700 hover:border-[var(--plana-primary)] hover:bg-pink-50/50'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1 skew-x-6">
                            {isSelected && <Check size={12} className="stroke-[3]" />}
                            {studentName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Main Content: Results Grid OR 5x2 Waiting Slots */}
              <div className="mt-4 flex-1 flex flex-col items-center justify-center min-h-[220px]">
                {results.length === 0 ? (
                  // Empty State: 5x2 Dashed Waiting Slots
                  <div className="w-full flex flex-col items-center justify-center py-2">
                    {isEncore && !encoreTarget ? (
                      <div className="p-6 text-center max-w-sm">
                        <AlertCircle size={28} className="text-amber-500 mx-auto mb-2" />
                        <p className="text-xs sm:text-sm font-bold text-slate-900">
                          대상 미지정 — 앙코르 학생을 선택하십시오
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          상단 목록에서 픽업 학생을 지정해야 모집 단말이 가동됩니다.
                        </p>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col items-center">
                        <div className="grid grid-cols-5 gap-2 sm:gap-3.5 w-fit mx-auto">
                          {Array.from({ length: 10 }).map((_, slotIdx) => (
                            <div
                              key={slotIdx}
                              className="w-[54px] h-[68px] sm:w-[76px] sm:h-[94px] md:w-[92px] md:h-[114px] rounded-xs border-2 border-dashed border-[var(--plana-border)]/70 flex flex-col items-center justify-between p-1.5 -skew-x-6 bg-white/40"
                            >
                              <span className="text-[9px] font-mono text-[var(--plana-primary-dark)]/70 skew-x-6 self-start">
                                {String(slotIdx + 1).padStart(2, '0')}
                              </span>
                              <div className="w-4 h-4 rounded-full border border-dashed border-[var(--plana-border)] skew-x-6" />
                              <span className="text-[8px] font-mono tracking-wider text-[var(--plana-primary-dark)]/70 uppercase skew-x-6">
                                SLOT
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 bg-white/90 border border-[var(--plana-border)] text-[var(--plana-primary-dark)] text-[10px] font-bold uppercase tracking-widest rounded-xs font-mono shadow-xs">
                            RECRUIT READY
                          </span>
                          <p className="text-[11px] text-slate-400 mt-1">
                            하단 조작 패널에서 1회 또는 10회 모집을 실행하십시오.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Results Grid: -skew-x-6 Result Cards with Star Bar & 1-shot Light Sweep
                  <div className="w-full flex items-center justify-center py-2">
                    <div className={`w-fit mx-auto ${results.length === 1 ? 'flex justify-center' : 'grid grid-cols-5 gap-2 sm:gap-3.5'}`}>
                      {results.map((r, idx) => {
                        const normalizedName = r.name.replace(/\s+/g, '');
                        const student = masterDataMap[normalizedName];
                        const isNew = r.isNew;

                        const rarityBorderClass =
                          r.rarity === 3
                            ? 'border-rose-400 bg-rose-50'
                            : r.rarity === 2
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-slate-300 bg-slate-100';

                        const rarityTopStripClass =
                          r.rarity === 3
                            ? 'bg-rose-400'
                            : r.rarity === 2
                            ? 'bg-amber-400'
                            : 'bg-slate-300';

                        return (
                          <div
                            key={idx}
                            className={`relative w-[54px] h-[68px] sm:w-[76px] sm:h-[94px] md:w-[92px] md:h-[114px] rounded-xs border-2 flex flex-col justify-between overflow-hidden -skew-x-6 transition-all duration-200 animate-recruit-in motion-reduce:animate-none group hover:shadow-md ${rarityBorderClass}`}
                            style={{ animationDelay: `${idx * 0.04}s` }}
                          >
                            {/* Top 3px Solid Rarity Color Strip */}
                            <div className={`h-[3px] w-full z-20 shrink-0 ${rarityTopStripClass}`} />

                            {/* 1-shot Light Sweep on 3★ card */}
                            {r.rarity === 3 && (
                              <div className="absolute inset-0 pointer-events-none overflow-hidden z-[25]">
                                <div
                                  className="w-[45%] h-full bg-gradient-to-r from-transparent via-white/80 to-transparent animate-light-sweep motion-reduce:animate-none"
                                  style={{ animationDelay: `${idx * 0.04 + 0.15}s` }}
                                />
                              </div>
                            )}

                            {/* NEW Acquired Diagonal Micro-Badge */}
                            {isNew && (
                              <div className="absolute top-1 left-1 z-30 bg-gradient-to-r from-[var(--plana-primary-dark)] to-rose-500 text-white font-mono font-bold text-[8px] sm:text-[9px] px-1 py-0.5 rounded-xs uppercase tracking-tighter skew-x-6 shadow-2xs">
                                NEW
                              </div>
                            )}

                            {/* Guarantee Micro-Badges (G100 / G200) */}
                            {r.guaranteeType === 'charge_200' && (
                              <div className="absolute top-1 right-1 z-30 bg-gradient-to-r from-[var(--plana-primary-dark)] to-rose-500 text-white font-mono font-bold text-[8px] px-1 py-0.5 rounded-xs uppercase tracking-tighter skew-x-6 shadow-2xs">
                                G200
                              </div>
                            )}
                            {r.guaranteeType === 'charge_100' && (
                              <div className="absolute top-1 right-1 z-30 bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-accent)] text-slate-800 font-mono font-bold text-[8px] px-1 py-0.5 rounded-xs uppercase tracking-tighter skew-x-6 shadow-2xs">
                                G100
                              </div>
                            )}

                            {/* Student Portrait */}
                            <div className="absolute inset-0 z-10 bg-slate-100 overflow-hidden flex items-center justify-center">
                              {student && student.portraitUrls && student.portraitUrls.length > 0 ? (
                                <Image
                                  src={getImageUrl(student.portraitUrls[0])}
                                  alt={r.name}
                                  fill
                                  unoptimized
                                  sizes="(max-width: 640px) 54px, (max-width: 768px) 76px, 92px"
                                  className="object-cover object-top skew-x-6 scale-110 group-hover:scale-115 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center skew-x-6">
                                  <User size={20} className="text-slate-400 opacity-60" />
                                  <span className="text-[8px] font-bold text-slate-500 truncate w-full text-center px-0.5">
                                    {r.name}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="relative z-10 flex-1" />

                            {/* Bottom Star Bar (#394251 with gold stars) */}
                            <div className="relative z-20 h-[15px] sm:h-[18px] bg-[#394251] flex justify-center items-center">
                              <div className="flex items-center gap-[1px] text-[8px] sm:text-[11px] skew-x-6 text-[#fadb5b] drop-shadow-xs leading-none">
                                {'★'.repeat(r.rarity)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Tactical Control Bar Inline Container */}
            <div className="hidden sm:flex items-center justify-between gap-3 pt-3 mt-4 border-t border-[var(--plana-border)]/60">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetHistory}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-[var(--plana-primary-dark)] hover:bg-pink-50/50 rounded-xs transition-colors border border-transparent hover:border-[var(--plana-border)] font-medium"
                  title="결과 및 누적 기록 초기화"
                >
                  <RotateCcw size={13} />
                  <span>기록 초기화</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetStacks}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xs transition-colors border border-transparent hover:border-rose-200 font-medium"
                  title="차지 스택 초기화"
                >
                  <RotateCcw size={13} className="text-rose-400" />
                  <span>스택 리셋</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePull('single')}
                  disabled={isEncore && !encoreTarget}
                  className="px-4 py-2 bg-white/90 hover:bg-pink-50/60 text-slate-800 font-bold border border-[var(--plana-border)] rounded-xs text-xs sm:text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  1회 모집
                </button>
                <button
                  type="button"
                  onClick={() => handlePull('ten')}
                  disabled={isEncore && !encoreTarget}
                  className="group px-5 py-2 bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-primary-dark)] hover:from-[var(--plana-primary-dark)] hover:to-[#f06e9d] text-white font-bold rounded-xs text-xs sm:text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-pink-300/40 border border-[var(--plana-primary-dark)]"
                >
                  <span>{results.length > 0 ? '10회 더 모집' : '10회 모집'}</span>
                  <span className="text-white group-hover:translate-x-0.5 transition-transform duration-150">
                    ▶
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* TELEMETRY & CHARGE PANELS (col-span-4) */}
          <aside className="md:col-span-4 flex flex-col space-y-3.5">

            {/* 1. 20-Segment Charge Gauge Panel */}
            <div className="bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs p-3.5 sm:p-4 shadow-xs space-y-3">
              {/* Header: Title, Type Badge, and Current Stack */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--plana-primary-dark)]">
                    RECRUIT CHARGE
                  </div>
                  <h3 className="text-sm sm:text-base font-bold font-title-v text-slate-900 tracking-tight leading-tight">
                    {isLimited ? '한정 모집 차지' : '모집 차지'}
                  </h3>
                </div>

                <div className="flex items-baseline gap-1 text-right font-mono tabular-nums">
                  <span
                    className={`text-xl sm:text-2xl font-bold tracking-tight ${
                      isCapReached ? 'text-rose-500' : 'text-slate-900'
                    }`}
                  >
                    {currentChargeStack}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ 200</span>
                </div>
              </div>

              {/* 20-Segment Discrete Charge Gauge Bar with 100-Notch & Kusoarona Marker */}
              <div className="space-y-1.5 pt-3">
                {/* 100 & 200 Milestone Top Indicators */}
                <div className="relative h-4 text-[10px] font-mono">
                  {/* 100-charge notch pin with 16px mini kusoarona marker */}
                  <div className="absolute left-1/2 -translate-x-1/2 -top-1 flex flex-col items-center">
                    <div
                      className={`flex items-center gap-1 px-1 py-0.5 rounded-xs border transition-colors ${
                        isMidpointReached
                          ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-2xs'
                          : 'bg-white/80 border-[var(--plana-border)]/60 text-slate-500'
                      }`}
                    >
                      <Image
                        src={kusoaronaImg}
                        alt="100 차지 봉투"
                        width={14}
                        height={14}
                        className="object-contain"
                      />
                      <span className="text-[9px] font-bold leading-none font-mono">100</span>
                    </div>
                    <div className={`w-0.5 h-1.5 mt-0.5 ${isMidpointReached ? 'bg-[var(--plana-primary-dark)]' : 'bg-slate-300'}`} />
                  </div>

                  {/* 200-charge cap indicator */}
                  <div className="absolute right-0 -top-1 flex flex-col items-end">
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded-xs border transition-colors ${
                        isCapReached
                          ? 'bg-gradient-to-r from-[var(--plana-primary-dark)] to-rose-500 border-rose-500 text-white shadow-2xs'
                          : 'bg-white/80 border-[var(--plana-border)]/60 text-slate-500'
                      }`}
                    >
                      200 CAP
                    </span>
                    <div className={`w-0.5 h-1.5 mt-0.5 mr-1 ${isCapReached ? 'bg-rose-500' : 'bg-slate-300'}`} />
                  </div>
                </div>

                {/* 20 Segment Blocks */}
                <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-0.5 p-1 bg-white/70 border border-[var(--plana-border)] rounded-xs shadow-inner">
                  {Array.from({ length: 20 }).map((_, segIdx) => {
                    const isFilled = segIdx < filledSegments;
                    const segmentColor = isCapReached
                      ? 'bg-gradient-to-t from-[var(--plana-primary-dark)] to-rose-500 shadow-[0_0_6px_rgba(255,136,179,0.7)]'
                      : isFilled
                      ? segIdx < 10
                        ? 'bg-gradient-to-t from-[var(--plana-primary)] to-[var(--plana-primary-light)] shadow-[0_0_4px_rgba(255,166,201,0.5)]'
                        : 'bg-gradient-to-t from-[var(--plana-primary-dark)] to-[var(--plana-accent)] shadow-[0_0_5px_rgba(224,207,252,0.6)]'
                      : 'bg-slate-100/80 border border-slate-200/50';

                    return (
                      <div
                        key={segIdx}
                        className={`h-3 rounded-xs transition-all duration-150 ${segmentColor}`}
                        title={`스택 ${(segIdx + 1) * 10}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Milestone Checklist (2 Lines) */}
              <div className="space-y-1.5 pt-1 text-xs">
                {/* 100 Stack Milestone */}
                <div
                  className={`flex items-center justify-between p-2 rounded-xs border transition-colors ${
                    isMidpointReached
                      ? 'bg-purple-50/60 border-purple-200 text-slate-900 shadow-2xs'
                      : 'bg-white/80 border-[var(--plana-border)]/60 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      <Image
                        src={kusoaronaImg}
                        alt="3★ 봉투"
                        width={16}
                        height={16}
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold leading-tight">100 차지: 3★ 1명 확정</div>
                      <div className="text-[10px] text-slate-400 leading-tight">픽업 확률 50% 보장</div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-xs ${
                      isMidpointReached
                        ? 'bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-accent)] text-slate-800 shadow-2xs font-bold'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isMidpointReached ? '✔ 달성' : `${100 - currentChargeStack}회 남음`}
                  </span>
                </div>

                {/* 200 Stack Milestone */}
                <div
                  className={`flex items-center justify-between p-2 rounded-xs border transition-colors ${
                    isCapReached
                      ? 'bg-rose-50/60 border-[var(--plana-primary)] text-slate-900 shadow-2xs'
                      : 'bg-white/80 border-[var(--plana-border)]/60 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-xs flex items-center justify-center shrink-0 ${
                        isCapReached
                          ? 'bg-gradient-to-r from-[var(--plana-primary-dark)] to-rose-500 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <BrickWallIcon size={10} />
                    </span>
                    <div>
                      <div className="text-[11px] font-bold leading-tight">200 차지: 픽업 확정</div>
                      <div className="text-[10px] text-slate-400 leading-tight">천장 즉시 영입</div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-xs ${
                      isCapReached
                        ? 'bg-gradient-to-r from-[var(--plana-primary-dark)] to-rose-500 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCapReached ? '✔ 달성' : `${200 - currentChargeStack}회 남음`}
                  </span>
                </div>
              </div>

              {/* Footnote */}
              <p className="text-[10px] text-slate-400 leading-tight pt-1">
                ※ 픽업 학생 영입 시 차지 스택은 0으로 초기화되며, 다음 픽업으로 이월됩니다.
              </p>
            </div>

            {/* 2. Derived SESSION Statistics Panel */}
            <div className="bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs p-3.5 sm:p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--plana-primary-dark)]">
                    SESSION TELEMETRY
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 font-title-v">
                    모집 통계
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  ID: S-{sessionStats.sessionPad}
                </span>
              </div>

              {/* 4-Metric Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                <div className="p-2 bg-white/70 border border-[var(--plana-border)]/60 rounded-xs">
                  <div className="text-[10px] text-slate-400 font-sans">청휘석 소모</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {sessionStats.pyroxeneConsumed.toLocaleString()}
                  </div>
                </div>

                <div className="p-2 bg-white/70 border border-[var(--plana-border)]/60 rounded-xs">
                  <div className="text-[10px] text-slate-400 font-sans">3★ 획득률</div>
                  <div className="text-sm font-bold text-rose-500 mt-0.5">
                    {sessionStats.rate3}%
                  </div>
                </div>

                <div className="p-2 bg-white/70 border border-[var(--plana-border)]/60 rounded-xs">
                  <div className="text-[10px] text-slate-400 font-sans">픽업 영입</div>
                  <div className="text-sm font-bold text-[var(--plana-primary-dark)] mt-0.5">
                    {sessionStats.pickupCount}
                    <span className="text-[10px] text-slate-400 font-sans ml-0.5">명</span>
                  </div>
                </div>

                <div className="p-2 bg-white/70 border border-[var(--plana-border)]/60 rounded-xs">
                  <div className="text-[10px] text-slate-400 font-sans">총 모집 횟수</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {sessionStats.totalPulls}
                    <span className="text-[10px] text-slate-400 font-sans ml-0.5">회</span>
                  </div>
                </div>
              </div>

              {/* Rarity Distribution Summary */}
              <div className="pt-2 border-t border-[var(--plana-border)]/40 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                <span className="text-[10px] text-slate-400 font-sans">등급 분포</span>
                <span>
                  3★ <strong className="text-rose-500">{sessionStats.count3}</strong> · 2★{' '}
                  <strong className="text-amber-600">{sessionStats.count2}</strong> · 1★{' '}
                  <strong className="text-slate-600">{sessionStats.count1}</strong>
                </span>
              </div>
            </div>

          </aside>
        </div>

        {/* 4. Tabular Acquisition Ledger */}
        {pullHistory.length > 0 && (
          <section className="bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs p-3.5 sm:p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-[var(--plana-border)]/60">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-[var(--plana-primary-dark)]" />
                <h3 className="text-sm sm:text-base font-bold font-title-v text-slate-900 tracking-tight">
                  모집 기록 (RECRUIT RECORD)
                </h3>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500">
                3★ <strong className="text-rose-500">{sessionStats.count3}</strong> · 2★{' '}
                <strong className="text-amber-600">{sessionStats.count2}</strong> · 1★{' '}
                <strong className="text-slate-600">{sessionStats.count1}</strong> · 총{' '}
                <strong className="text-slate-900">{pullHistory.length}</strong>회 모집
              </div>
            </div>

            {/* High Priority & Pickups Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {highPriorityItems.map(([name, data]) => {
                const normalizedName = name.replace(/\s+/g, '');
                const student = masterDataMap[normalizedName];

                return (
                  <div
                    key={name}
                    className={`flex items-center justify-between p-2 rounded-xs border text-xs transition-colors ${
                      data.isPickup
                        ? 'border-l-2 border-l-[var(--plana-primary-dark)] bg-pink-50/40 border-[var(--plana-border)]/70'
                        : data.rarity === 3
                        ? 'border-l-2 border-l-rose-400 bg-white/80 border-[var(--plana-border)]/60'
                        : 'border-l-2 border-l-amber-400 bg-white/80 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xs overflow-hidden border border-[var(--plana-border)]/60 shrink-0 bg-slate-100 relative">
                        {student && student.portraitUrls && student.portraitUrls.length > 0 ? (
                          <Image
                            src={getImageUrl(student.portraitUrls[0])}
                            alt={name}
                            fill
                            unoptimized
                            sizes="32px"
                            className="object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User size={14} className="text-slate-400" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1 leading-none mb-1">
                          <span
                            className={`text-[9px] font-mono font-bold ${
                              data.isPickup
                                ? 'text-[var(--plana-primary-dark)]'
                                : data.rarity === 3
                                ? 'text-rose-500'
                                : 'text-amber-600'
                            }`}
                          >
                            {data.isPickup ? 'PICKUP' : '★'.repeat(data.rarity)}
                          </span>
                        </div>
                        <div className="font-bold text-slate-800 text-xs truncate">{name}</div>
                      </div>
                    </div>

                    <div className="font-mono font-bold text-sm text-slate-900 tabular-nums shrink-0 ml-2">
                      ×{data.count}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Collapsible 1★ Fold */}
            {oneStarItems.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsFold1StarOpen(!isFold1StarOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white/80 hover:bg-pink-50/40 border border-[var(--plana-border)]/60 rounded-xs text-xs text-slate-600 transition-colors"
                >
                  <span className="font-medium">
                    1★ 학생 ({oneStarItems.length}종) {isFold1StarOpen ? '접기' : '펼치기'}
                  </span>
                  {isFold1StarOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isFold1StarOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-2 pt-1 border-t border-[var(--plana-border)]/40">
                    {oneStarItems.map(([name, data]) => {
                      const normalizedName = name.replace(/\s+/g, '');
                      const student = masterDataMap[normalizedName];

                      return (
                        <div
                          key={name}
                          className="flex items-center justify-between p-2 rounded-xs border border-[var(--plana-border)]/50 bg-white/70 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-xs overflow-hidden border border-[var(--plana-border)]/50 shrink-0 bg-slate-100 relative">
                              {student && student.portraitUrls && student.portraitUrls.length > 0 ? (
                                <Image
                                  src={getImageUrl(student.portraitUrls[0])}
                                  alt={name}
                                  fill
                                  unoptimized
                                  sizes="32px"
                                  className="object-cover object-top"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User size={14} className="text-slate-400" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="text-[9px] font-mono text-slate-400 leading-none mb-1">
                                ★
                              </div>
                              <div className="font-medium text-slate-700 text-xs truncate">{name}</div>
                            </div>
                          </div>

                          <div className="font-mono text-sm text-slate-600 tabular-nums shrink-0 ml-2">
                            ×{data.count}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

      </div>

      {/* 5. Mobile Sticky CTA Bar (< md screens) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-[var(--plana-border)] p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleResetHistory}
              className="p-2 text-slate-500 hover:text-[var(--plana-primary-dark)] hover:bg-pink-50/50 border border-[var(--plana-border)] hover:border-[var(--plana-primary)] rounded-xs bg-white/90 text-xs shadow-xs transition-all duration-150 active:scale-[0.95]"
              title="기록 초기화"
              aria-label="기록 초기화"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={handleResetStacks}
              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 border border-rose-200 hover:border-rose-300 rounded-xs bg-rose-50 text-xs shadow-xs transition-all duration-150 active:scale-[0.95]"
              title="스택 리셋"
              aria-label="스택 리셋"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <button
              type="button"
              onClick={() => handlePull('single')}
              disabled={isEncore && !encoreTarget}
              className="flex-1 max-w-[120px] py-2.5 bg-white/90 hover:bg-pink-50/60 text-slate-800 font-bold border border-[var(--plana-border)] hover:border-[var(--plana-primary)] rounded-xs text-xs active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all duration-150"
            >
              1회 모집
            </button>
            <button
              type="button"
              onClick={() => handlePull('ten')}
              disabled={isEncore && !encoreTarget}
              className="flex-1 py-2.5 bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-primary-dark)] hover:from-[var(--plana-primary-dark)] hover:to-[#f06e9d] text-white font-bold rounded-xs text-xs active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 border border-[var(--plana-primary-dark)] shadow-md shadow-pink-300/40 transition-all duration-150"
            >
              <span>{results.length > 0 ? '10회 더 모집' : '10회 모집'}</span>
              <span className="text-white">▶</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
