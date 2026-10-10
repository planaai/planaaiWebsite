'use client';

import React from 'react';
import { Sparkles, RotateCcw, User, AlertCircle, Zap, Star, Award, Info, BarChart2 } from 'lucide-react';
import { getImageUrl } from '@/components/planner/utils';
import { useGacha } from '@/hooks/useGacha';
import type { GachaBanner, GachaPickup, GuaranteeType } from '@/lib/gachaLogic';

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

  const isLimited = chargeType === 'limited';

  const getCardStyle = (rarity: number) => {
    if (rarity === 3) return 'border-[#ff8ac8] bg-[#ff8ac8] shadow-[0_0_15px_rgba(255,138,200,0.8)]';
    if (rarity === 2) return 'border-[#f2cd5c] bg-[#f2cd5c] shadow-[0_0_10px_rgba(242,205,92,0.8)]';
    return 'border-[#b0b6c0] bg-[#b0b6c0]';
  };

  const getGuaranteeBadge = (type?: GuaranteeType) => {
    if (type === 'charge_200') {
      return (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30 bg-gradient-to-r from-[var(--plana-primary-dark)] to-purple-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-md border border-pink-200">
          200차지 픽업 확정
        </span>
      );
    }
    if (type === 'charge_100') {
      return (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30 bg-gradient-to-r from-[#FF88B3] to-[#FF6599] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-md border border-pink-200">
          100차지 3★ 확정
        </span>
      );
    }
    return null;
  };

  if (!gachaData) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center justify-center text-slate-500">
          <Sparkles className="animate-pulse mb-3 text-[var(--plana-primary)]" size={36} />
          <p className="font-bold text-sm">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 픽업 확률 합산
  const totalPickupRate = (
    banner?.pickups?.reduce((sum: number, p: GachaPickup) => {
      const rateVal = p.rate !== undefined ? p.rate * 100 : (p.probability || 0);
      return sum + rateVal;
    }, 0) || 0
  ).toFixed(1);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 text-slate-700 font-sans p-2.5 sm:p-4">
      <div className="max-w-[1100px] mx-auto space-y-3">
        
        {/* Header & Global Stats */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <Sparkles className="text-[var(--plana-primary)]" size={20} /> 모의 가챠 시뮬레이터
          </h1>

          <div className="flex items-center gap-2">
            <div className="text-xs font-bold bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5">
              <span>누적:</span>
              <span className="text-[var(--plana-primary)] text-sm font-black">{pullHistory.length}</span>
              <span className="text-slate-400 font-normal">회</span>
            </div>
          </div>
        </div>

        {/* Banner Selection Tabs */}
        {gachaData.banners && gachaData.banners.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
            {gachaData.banners.map((b: GachaBanner, idx: number) => {
              const active = activeBannerIndex === idx;
              return (
                <button
                  key={b.id || idx}
                  onClick={() => {
                    setActiveBannerIndex(idx);
                    setResults([]);
                    setEncoreTarget('');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-200 ${
                    active
                      ? 'bg-[var(--plana-primary)] text-white shadow-sm border border-pink-400'
                      : 'bg-white text-slate-600 hover:text-[var(--plana-primary)] hover:bg-pink-50 border border-slate-200'
                  }`}
                >
                  {b.name || `픽업 모집 #${idx + 1}`}
                </button>
              );
            })}
          </div>
        )}

        {/* 모집 차지 (Recruitment Charge) Plana Theme Card - Compact */}
        <div className="relative bg-white/95 backdrop-blur-md border border-[var(--plana-border)] rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute -top-8 -right-8 w-60 h-60 bg-gradient-to-br from-[#FFA6C9]/20 via-[#E0CFFC]/15 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-2.5">
            {/* Header: Title, Type Badge, and Current Stack */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-xs bg-gradient-to-br from-[#FFA6C9] to-[#FF88B3] text-white">
                  <Zap size={14} className="drop-shadow-xs" />
                </div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">
                    {isLimited ? '한정 모집 차지' : '모집 차지'}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isLimited 
                      ? 'bg-[#F3E8FF] text-[#9333EA] border-[#E0CFFC]' 
                      : 'bg-[#FFF0F5] text-[#FF5A92] border-[#FFA6C9]/50'
                  }`}>
                    {isLimited ? '한정 픽업' : '일반 픽업'}
                  </span>
                </div>
              </div>

              {/* Stack Counter */}
              <div className="flex items-baseline gap-1 text-right">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-[#FF6599] drop-shadow-xs">
                  {currentChargeStack}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 200 차지</span>
              </div>
            </div>

            {/* Gauge Progress Bar */}
            <div className="relative">
              <div className="w-full bg-[#FFF5F8] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#FFA6C9]/40 shadow-inner relative">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-[#FFA6C9] via-[#FF88B3] to-[#FF6599] shadow-[0_0_8px_rgba(255,166,201,0.5)]"
                  style={{ width: `${Math.min((currentChargeStack / 200) * 100, 100)}%` }}
                />
                {/* 100 Stack Midpoint Marker */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white shadow-xs z-10" />
              </div>
            </div>

            {/* Checkpoint Milestone Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* 100 Stack Checkpoint */}
              <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl border transition-all ${
                currentChargeStack >= 100
                  ? 'bg-gradient-to-r from-[#FFF0F5] to-white border-[#FF88B3] text-slate-800 shadow-xs'
                  : 'bg-gradient-to-r from-[#FFFBFD] to-white border-[#FFA6C9]/30 text-slate-600'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shadow-xs ${
                    currentChargeStack >= 100
                      ? 'bg-gradient-to-br from-[#FF88B3] to-[#FF6599] text-white'
                      : 'bg-[#FFE4EE] text-[#FF5A92]'
                  }`}>
                    <Star size={10} className="fill-current" />
                  </span>
                  <div>
                    <div className="text-[11px] font-black text-slate-800 leading-tight">100 차지: 3★ 1명 확정</div>
                    <div className="text-[10px] text-slate-500 leading-tight">픽업 확률 50%</div>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  currentChargeStack >= 100
                    ? 'bg-[#FF6599] text-white shadow-xs'
                    : 'bg-[#FFF0F5] text-[#FF5A92] border border-[#FFA6C9]/40'
                }`}>
                  {currentChargeStack >= 100 ? '달성' : `${100 - currentChargeStack}회 남음`}
                </span>
              </div>

              {/* 200 Stack Checkpoint */}
              <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl border transition-all ${
                currentChargeStack >= 200
                  ? 'bg-gradient-to-r from-[#FAF5FF] to-white border-[#C084FC] text-slate-800 shadow-xs'
                  : 'bg-gradient-to-r from-[#FDFBFF] to-white border-[#E0CFFC]/50 text-slate-600'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shadow-xs ${
                    currentChargeStack >= 200
                      ? 'bg-gradient-to-br from-[#9333EA] to-[#7E22CE] text-white'
                      : 'bg-[#F3E8FF] text-[#9333EA]'
                  }`}>
                    <Award size={11} className="fill-current" />
                  </span>
                  <div>
                    <div className="text-[11px] font-black text-slate-800 leading-tight">200 차지: 픽업 확정</div>
                    <div className="text-[10px] text-slate-500 leading-tight">천장 즉시 영입</div>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  currentChargeStack >= 200
                    ? 'bg-[#9333EA] text-white shadow-xs'
                    : 'bg-[#FAF5FF] text-[#9333EA] border border-[#E0CFFC]'
                }`}>
                  {currentChargeStack >= 200 ? '달성' : `${200 - currentChargeStack}회 남음`}
                </span>
              </div>
            </div>

            {/* Bottom Guide Text */}
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-500 bg-gradient-to-r from-[#FFF5F8]/90 to-[#FAF5FF]/90 rounded-xl px-3 py-1.5 border border-[#FFA6C9]/30">
              <Info size={12} className="text-[#FF6599] shrink-0" />
              <span>
                픽업 캐릭터 획득 시 스택이 즉시 <strong>0</strong>으로 초기화되며, 다음 픽업으로 이월됩니다.
              </span>
            </div>
          </div>
        </div>

        {/* Main Gacha Area - Compact */}
        <div className="relative bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-lg overflow-hidden min-h-[350px] flex flex-col">
          {/* Subtle background glow */}
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--plana-primary)]/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-600/10 blur-[80px] rounded-full pointer-events-none" />

          <div className="relative z-10 flex-1 flex flex-col">
            <div className="text-center mb-3">
              <h2 className="text-base sm:text-lg font-black text-slate-800 mb-1">
                {banner?.name || '픽업 모집'}
              </h2>
              {isEncore ? (
                <p className="text-slate-500 text-xs">
                  확률 - 3★: 3.0% (선택 픽업 0.7%) | 2★: 18.5% | 1★: 78.5%
                </p>
              ) : (
                <p className="text-slate-500 text-xs">
                  확률 - 3★: 3.0% (픽업 {totalPickupRate}%) | 2★: 18.5% | 1★: 78.5%
                </p>
              )}
            </div>

            {/* Content Area */}
            {results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-4">
                {isEncore && (
                  <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-inner max-w-xl w-full">
                    <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center justify-center gap-1.5">
                      <Sparkles className="text-pink-500" size={16} />
                      앙코르 픽업 대상을 선택하세요
                    </h3>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {ENCORE_STUDENTS.map((studentName) => (
                        <button
                          key={studentName}
                          onClick={() => setEncoreTarget(studentName)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            encoreTarget === studentName
                              ? 'bg-pink-100 border-pink-400 text-pink-600 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300 hover:bg-pink-50'
                          }`}
                        >
                          {studentName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center justify-center text-slate-400 min-h-[90px]">
                  {!isEncore || encoreTarget ? (
                    <>
                      <Sparkles size={36} className="opacity-25 mb-2 text-[var(--plana-primary)]" />
                      <p className="font-bold text-slate-600 text-xs">하단의 모집 버튼을 눌러주세요</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">100스택 / 200스택 도달 시 보장 기능이 발동합니다.</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={36} className="opacity-30 mb-2 text-orange-400" />
                      <p className="font-bold text-orange-600 text-xs">앙코르 픽업 대상을 선택해야 모집이 가능합니다.</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex-1 flex items-center justify-center py-2">
                  <div className="grid grid-cols-5 gap-x-2.5 gap-y-4 sm:gap-x-4 sm:gap-y-6 w-fit mx-auto">
                    {results.map((r, idx) => {
                      const normalizedName = r.name.replace(/\s+/g, '');
                      const student = masterDataMap[normalizedName];
                      const isNew = r.isNew;

                      return (
                        <div
                          key={idx}
                          className={`relative w-[54px] h-[68px] sm:w-[76px] sm:h-[94px] md:w-[92px] md:h-[114px] rounded-lg border-[2.5px] flex flex-col justify-between overflow-visible transition-transform hover:-translate-y-0.5 -skew-x-[6deg] ${getCardStyle(
                            r.rarity
                          )}`}
                          style={{ animationDelay: `${idx * 0.03}s` }}
                        >
                          {/* New Tag */}
                          {isNew && (
                            <div
                              className="absolute -top-2.5 -left-2.5 sm:-top-3 sm:-left-3 text-[#fff200] font-black text-[11px] sm:text-base italic drop-shadow-[0_0_4px_rgba(255,242,0,0.8)] z-30 skew-x-[6deg]"
                              style={{ WebkitTextStroke: '0.75px #a46b00' }}
                            >
                              New
                            </div>
                          )}

                          {/* Guarantee Badge (100 / 200 stack) */}
                          {getGuaranteeBadge(r.guaranteeType)}

                          {/* Portrait */}
                          <div className="absolute inset-0 z-0 bg-slate-200 overflow-hidden rounded-md">
                            {student && student.portraitUrls && student.portraitUrls.length > 0 ? (
                              <img
                                src={getImageUrl(student.portraitUrls[0])}
                                alt={r.name}
                                className="w-full h-full object-cover object-top skew-x-[6deg] scale-110"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center skew-x-[6deg]">
                                <User size={22} className="text-slate-400 opacity-50" />
                                <span className="text-[8px] font-bold text-slate-500 mt-0.5 truncate w-full text-center px-0.5">
                                  {r.name}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="relative z-10 flex-1" />

                          {/* Stars Bottom Bar */}
                          <div className="relative z-10 h-[15px] sm:h-[18px] bg-[#394251] flex justify-center items-center rounded-b-[3px]">
                            <div className="flex items-center gap-[1px] text-[8px] sm:text-xs drop-shadow-xs skew-x-[6deg] text-[#fadb5b]">
                              {'★'.repeat(r.rarity)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2.5 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleResetHistory}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors border border-slate-200 text-xs"
                  title="결과 및 기록만 초기화"
                >
                  <RotateCcw size={14} />
                  기록 초기화
                </button>

                <button
                  onClick={handleResetStacks}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold rounded-xl transition-colors border border-slate-200 text-xs"
                  title="차지 스택 초기화"
                >
                  <RotateCcw size={14} className="text-red-500" />
                  스택 리셋
                </button>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => handlePull('single')}
                  disabled={isEncore && !encoreTarget}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-500 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors border border-slate-400 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  1회 모집
                </button>
                <button
                  onClick={() => handlePull('ten')}
                  disabled={isEncore && !encoreTarget}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-[var(--plana-primary)] hover:bg-pink-400 text-white font-black rounded-xl transition-all shadow-[0_0_15px_rgba(255,105,180,0.3)] hover:shadow-[0_0_20px_rgba(255,105,180,0.4)] border border-pink-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-xs sm:text-sm"
                >
                  {results.length > 0 ? '10회 더 모집' : '10회 모집'}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Inventory Summary - Compact */}
        {pullHistory.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
                <BarChart2 size={16} className="text-[var(--plana-primary)]" /> 획득 기록 요약
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                총 {pullHistory.length}회 모집 완료
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {inventorySummary.map(([name, data]) => {
                const normalizedName = name.replace(/\s+/g, '');
                const student = masterDataMap[normalizedName];
                return (
                  <div
                    key={name}
                    className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs ${
                      data.isPickup
                        ? 'bg-pink-100 border-pink-300 text-pink-600'
                        : data.rarity === 3
                        ? 'bg-pink-50 border-pink-200 text-pink-500'
                        : data.rarity === 2
                        ? 'bg-white border-yellow-300 text-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-current shadow-xs flex-shrink-0 bg-white/80 flex items-center justify-center">
                      {student && student.portraitUrls && student.portraitUrls.length > 0 ? (
                        <img
                          src={getImageUrl(student.portraitUrls[0])}
                          alt={name}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <User size={13} className="text-slate-400 opacity-50" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] opacity-70 leading-none mb-0.5">
                        {data.isPickup ? 'PICKUP' : '★'.repeat(data.rarity)}
                      </span>
                      <span className="font-bold text-xs leading-none whitespace-nowrap">{name}</span>
                    </div>
                    <div className="h-4 w-px bg-current opacity-20" />
                    <span className="font-black text-sm">x{data.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
