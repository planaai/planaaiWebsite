'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { PyroxeneData, ScheduledEvent } from '@/lib/pyroxeneParser';
import { Calendar, Calculator, Sparkles, Settings, ListCollapse, ShoppingCart, Download } from 'lucide-react';

import PyroxeneExportTemplate from './ap-calculator/PyroxeneExportTemplate';
import { usePyroxeneCalc } from '@/hooks/usePyroxeneCalc';

interface Props {
  data: PyroxeneData;
  events: ScheduledEvent[];
}

export default function PyroxeneCalculator({ data, events }: Props) {
  const {
    startDateStr, setStartDateStr,
    targetDateStr, setTargetDateStr,
    tacticalRank, setTacticalRank,
    taTier, setTaTier,
    attendanceDay, setAttendanceDay,
    selectedMonthlyPkgs, setSelectedMonthlyPkgs,
    selectedWeeklyPkgs, setSelectedWeeklyPkgs,
    selectedOneTimePkgs, setSelectedOneTimePkgs,
    totalAmount, activeEvents, breakdown, totalCost, costBreakdown,
    ONE_TIME_PACKAGES
  } = usePyroxeneCalc(data, events);

  const [packageTab, setPackageTab] = useState<'monthly' | 'weekly' | 'onetime'>('monthly');

  const exportRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);

    try {
      const images = exportRef.current.querySelectorAll('img');
      const originalSrcs = new Map<HTMLImageElement, string>();
      
      images.forEach(img => {
        if (img.src.startsWith('http') && !img.src.includes(window.location.host)) {
          originalSrcs.set(img, img.src);
          img.crossOrigin = 'anonymous';
          img.src = `/api/proxy/image?url=${encodeURIComponent(img.src)}&_t=${Date.now()}`;
        }
      });
      
      await Promise.all(Array.from(images).map(async (img) => {
        if (!originalSrcs.has(img)) originalSrcs.set(img, img.src);
        
        try {
          if (!img.complete) {
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
          }
          
          if (img.naturalWidth === 0) {
            throw new Error('Broken image');
          }
          
          if (img.src.startsWith('data:')) return;
          
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 1;
          canvas.height = img.naturalHeight || img.height || 1;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            img.src = canvas.toDataURL('image/png');
          }
        } catch (e) {
          img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        }
      }));

      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      
      originalSrcs.forEach((src, img) => {
        img.src = src;
        img.removeAttribute('crossOrigin');
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
      link.download = `청휘석_계산_보고서_${dateStr}_${timeStr}.png`;
      link.click();
    } catch (error) {
      console.error('Failed to export image', error);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleMonthlyPkg = (name: string, isChecked: boolean) => {
    setSelectedMonthlyPkgs(prev => ({
      ...prev,
      [name]: isChecked ? 1 : 0
    }));
  };

  const updateMonthlyPkg = (name: string, count: number) => {
    setSelectedMonthlyPkgs(prev => ({
      ...prev,
      [name]: count
    }));
  };

  const updateWeeklyPkg = (name: string, count: number) => {
    setSelectedWeeklyPkgs(prev => ({
      ...prev,
      [name]: count
    }));
  };

  const updateOneTimePkg = (name: string, count: number) => {
    setSelectedOneTimePkgs(prev => ({
      ...prev,
      [name]: count
    }));
  };

  const sortedWeeklyPackages = useMemo(() => {
    return [...data.weeklyPackages].sort((a, b) => {
      const getWeight = (name: string, index: number) => {
        const match = name.match(/주간 장비 패키지 (I|II|III|IV|V|VI|VII|VIII|IX|X)$/);
        if (!match) return index;
        const map: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10 };
        return 100 + map[match[1]];
      };

      const weightA = getWeight(a.name, data.weeklyPackages.indexOf(a));
      const weightB = getWeight(b.name, data.weeklyPackages.indexOf(b));

      return weightA - weightB;
    });
  }, [data.weeklyPackages]);

  const formatDate = (d: Date) => {
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  };

  const getTierImage = (tierName: string) => {
    switch (tierName) {
      case '플래티넘': return '/images/tier/platinum.png';
      case '골드': return '/images/tier/gold.png';
      case '실버': return '/images/tier/silver.png';
      case '브론즈': return '/images/tier/bronze.png';
      default: return null;
    }
  };

  const packageImageMap: Record<string, string> = {
    "2주 AP 패키지": "ap_package_2w",
    "신임교사용 활동 보고서 패키지 III": "activity_report_pkg_3",
    "월간 청휘석 6600개": "monthly_pyroxene_6600",
    "월간 청휘석 패키지": "monthly_pyroxene_pkg",
    "주간 장비 패키지 I": "weekly_equip_pkg_1",
    "주간 장비 패키지 II": "weekly_equip_pkg_2",
    "주간 장비 패키지 III": "weekly_equip_pkg_3",
    "주간 장비 패키지 IV": "weekly_equip_pkg_4",
    "주간 장비 패키지 V": "weekly_equip_pkg_5",
    "주간 장비 패키지 VI": "weekly_equip_pkg_6",
    "주간 장비 패키지 VII": "weekly_equip_pkg_7",
    "주간 활동 보고서 패키지 III": "weekly_activity_report_pkg_3",
    "청휘석 1184개 초회": "pyroxene_1184_first",
    "청휘석 120개 초회": "pyroxene_120_first",
    "청휘석 1350개": "pyroxene_1350",
    "청휘석 179개": "pyroxene_179",
    "청휘석 2300개": "pyroxene_2300",
    "청휘석 2352개 초회": "pyroxene_2352_first",
    "청휘석 352개 초회": "pyroxene_352_first",
    "청휘석 3920개 초회": "pyroxene_3920_first",
    "청휘석 420개": "pyroxene_420",
    "청휘석 4800개": "pyroxene_4800",
    "청휘석 60개": "pyroxene_60",
    "청휘석 6600개 초회": "pyroxene_6600_first",
    "청휘석 660개": "pyroxene_660",
    "청휘석 784개 초회": "pyroxene_784_first",
    "청휘석 8000개 초회": "pyroxene_8000_first",
    "하프 월간 청휘석 패키지": "half_monthly_pyroxene_pkg"
  };

  const getPackageImage = (pkgName: string) => {
    const sanitizedName = pkgName.replace(' (초회)', ' 초회');
    const englishName = packageImageMap[sanitizedName];
    // If not found in map, fallback to original behavior (though Cloudflare might break it)
    if (!englishName) {
      return `/images/package/${sanitizedName}.png`;
    }
    return `/images/package/${englishName}.png`;
  };

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--plana-primary)]"></div></div>;
  }

  return (
    <div className="space-y-6 slide-in-right-anim pb-20">

      {/* Header section */}
      <div className="flex justify-between items-start xl:items-center gap-4 flex-col xl:flex-row border-b-2 border-[var(--plana-border)] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/60 rounded-xl shadow-sm border border-[var(--plana-border)]">
            <Calculator className="w-8 h-8 text-[var(--plana-primary-dark)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--plana-text-main)]">개인 맞춤형 청휘석 계산기</h1>
            <p className="text-[var(--plana-text-muted)] mt-1">
              원하는 날짜까지 모을 수 있는 청휘석을 과금 성향과 랭킹에 맞게 예측합니다.
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 bg-[var(--plana-primary)] text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-[var(--plana-primary-dark)] transition-colors disabled:opacity-50 shrink-0"
        >
          <Download className="w-5 h-5" />
          {isExporting ? '이미지 생성 중...' : '결과 이미지로 저장'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Left Column: Settings */}
        <div className="xl:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-[var(--plana-text-main)] flex items-center gap-2 mb-6 border-b border-[var(--plana-border)] pb-3">
              <Calendar className="w-5 h-5 text-[var(--plana-primary)]" />
              기간 설정
            </h2>
            <div className="space-y-4 mb-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
                  <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">계산 시작일</label>
                  <input
                    type="date"
                    className="w-full bg-white text-[var(--plana-text-main)] p-3 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] transition-all"
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                  />
                </div>
                <div className="flex-1 bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
                  <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">목표 날짜 지정</label>
                  <input
                    type="date"
                    className="w-full bg-white text-[var(--plana-text-main)] p-3 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] transition-all"
                    value={targetDateStr}
                    onChange={(e) => setTargetDateStr(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-[var(--plana-text-main)] flex items-center gap-2 mb-6 border-b border-[var(--plana-border)] pb-3">
              <Settings className="w-5 h-5 text-[var(--plana-primary)]" />
              인게임 성적
            </h2>
            <div className="space-y-4 mb-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">오늘 출석일 (1~10일)</label>
                  <select
                    className="w-full bg-white text-[var(--plana-text-main)] p-3 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)]"
                    value={attendanceDay}
                    onChange={e => setAttendanceDay(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(day => (
                      <option key={day} value={day}>{day}일차</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">전술대회 등수</label>
                  <select
                    className="w-full bg-white text-[var(--plana-text-main)] p-3 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)]"
                    value={tacticalRank}
                    onChange={e => setTacticalRank(e.target.value)}
                  >
                    {data.tacticalRanks.map(r => (
                      <option key={r.rank} value={r.rank}>{r.rank}등 (일 {r.amount}개)</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">총력전 티어</label>
                  <div className="flex items-center gap-3">
                    {getTierImage(taTier) && (
                      <div className="w-12 h-12 relative flex-shrink-0">
                        <Image src={getTierImage(taTier)!} alt={taTier} fill unoptimized sizes="48px" className="object-contain drop-shadow-sm" />
                      </div>
                    )}
                    <select
                      className="w-full bg-white text-[var(--plana-text-main)] p-3 rounded-lg border border-[var(--plana-border)] outline-none"
                      value={taTier}
                      onChange={e => setTaTier(e.target.value)}
                    >
                      {data.totalAssaultTiers.map(t => (
                        <option key={t.name} value={t.name}>{t.name} ({t.amount}개)</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[var(--plana-text-muted)] text-right">* 총력전 누적 포인트 보상({data.assaultClearReward}개)은 기본 포함됩니다.</p>
              <div className="mt-4 p-3 bg-[var(--plana-primary-light)]/10 rounded-lg border border-[var(--plana-primary-light)]/30 text-xs text-[var(--plana-text-muted)] space-y-1">
                <p><strong>* 패키지 계산 안내:</strong></p>
                <p>- 월정액(일일/즉시지급), 월간 청휘석 6600개, 2주 AP 패키지는 <strong>매월 1일</strong>에 구매한다고 가정합니다.</p>
                <p>- 나머지 주간 패키지는 <strong>매주 월요일</strong>에 구매한다고 가정합니다.</p>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-3 mb-4 border-b border-[var(--plana-border)] pb-3">
              <h2 className="text-xl font-bold text-[var(--plana-text-main)] flex items-center gap-2 whitespace-nowrap">
                <ShoppingCart className="w-5 h-5 text-[var(--plana-primary)]" />
                과금 패키지
              </h2>
              <div className="flex gap-1 bg-gray-100/50 p-1 rounded-xl w-full xl:w-auto overflow-x-auto custom-scrollbar">
                <button
                  onClick={() => setPackageTab('monthly')}
                  className={`flex-none whitespace-nowrap px-3 py-1.5 rounded-lg font-bold text-sm transition-colors ${packageTab === 'monthly' ? 'bg-white shadow-sm text-[var(--plana-primary-dark)]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  월간 패키지
                </button>
                <button
                  onClick={() => setPackageTab('weekly')}
                  className={`flex-none whitespace-nowrap px-3 py-1.5 rounded-lg font-bold text-sm transition-colors ${packageTab === 'weekly' ? 'bg-white shadow-sm text-[var(--plana-primary-dark)]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  주간 패키지
                </button>
                <button
                  onClick={() => setPackageTab('onetime')}
                  className={`flex-none whitespace-nowrap px-3 py-1.5 rounded-lg font-bold text-sm transition-colors ${packageTab === 'onetime' ? 'bg-white shadow-sm text-[var(--plana-primary-dark)]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  단품 패키지
                </button>
              </div>
            </div>

            <div className="min-h-[350px]">
              {packageTab === 'monthly' && (
                <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                  {data.monthlyPackages.map(pkg => {
                    if (pkg.limit === 1) {
                      return (
                        <div key={pkg.name} className="group relative flex items-center gap-4 bg-white/30 p-3 rounded-lg border border-transparent hover:border-[var(--plana-border)] transition-colors cursor-pointer" onClick={() => toggleMonthlyPkg(pkg.name, !selectedMonthlyPkgs[pkg.name])}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={!!selectedMonthlyPkgs[pkg.name]}
                            onChange={(e) => toggleMonthlyPkg(pkg.name, e.target.checked)}
                          />
                          <div className="w-14 h-14 relative flex-shrink-0">
                            <Image src={getPackageImage(pkg.name)} alt={pkg.name} fill unoptimized sizes="56px" className="object-contain drop-shadow-sm" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[14px] text-[var(--plana-text-main)] group-hover:text-[var(--plana-primary-dark)]">{pkg.name}</span>
                            <span className="text-xs text-[var(--plana-text-muted)] mb-1">월 {pkg.limit}회</span>
                            <span className="text-sm font-bold text-[var(--plana-primary)]">{pkg.amount}개 <span className="text-[var(--plana-text-muted)] ml-1 font-normal text-xs">/ ₩{pkg.cost.toLocaleString()}</span></span>
                          </div>
                          <div className={`ml-auto w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedMonthlyPkgs[pkg.name] ? 'bg-[var(--plana-primary)] border-[var(--plana-primary)]' : 'border-gray-300'}`}>
                            {selectedMonthlyPkgs[pkg.name] > 0 && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={pkg.name} className="flex items-center gap-4 bg-white/30 p-3 rounded-lg border border-transparent hover:border-[var(--plana-border)] transition-colors">
                          <div className="w-16 h-16 relative flex-shrink-0">
                            <Image src={getPackageImage(pkg.name)} alt={pkg.name} fill unoptimized sizes="64px" className="object-contain drop-shadow-sm" />
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-[var(--plana-text-main)] text-[15px]">{pkg.name}</span>
                              <span className="text-xs text-[var(--plana-text-muted)] font-semibold bg-white/50 px-2 py-0.5 rounded">월 {pkg.limit}회</span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-sm font-semibold text-[var(--plana-primary)]">{pkg.amount}개</span>
                              <span className="text-sm font-bold text-[var(--plana-text-main)]">₩{pkg.cost.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-2 bg-white/50 rounded-lg p-1 w-max">
                              <button onClick={() => updateMonthlyPkg(pkg.name, Math.max(0, (selectedMonthlyPkgs[pkg.name] || 0) - 1))} className="w-8 h-8 rounded-md bg-white text-[var(--plana-text-main)] hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-primary-dark)] shadow-sm transition-colors font-bold text-lg flex items-center justify-center pb-1">-</button>
                              <span className="w-8 text-center font-bold text-[var(--plana-text-main)]">{selectedMonthlyPkgs[pkg.name] || 0}</span>
                              <button onClick={() => updateMonthlyPkg(pkg.name, Math.min(pkg.limit, (selectedMonthlyPkgs[pkg.name] || 0) + 1))} className="w-8 h-8 rounded-md bg-white text-[var(--plana-text-main)] hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-primary-dark)] shadow-sm transition-colors font-bold text-lg flex items-center justify-center pb-1">+</button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}

              {packageTab === 'weekly' && (
                <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                  {sortedWeeklyPackages.map(pkg => (
                    <div key={pkg.name} className="flex items-center gap-4 bg-white/30 p-3 rounded-lg border border-transparent hover:border-[var(--plana-border)] transition-colors">
                      <div className="w-16 h-16 relative flex-shrink-0">
                        <Image src={getPackageImage(pkg.name)} alt={pkg.name} fill sizes="64px" className="object-contain drop-shadow-sm" />
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-[var(--plana-text-main)] text-[15px]">{pkg.name}</span>
                          <span className="text-xs text-[var(--plana-text-muted)] font-semibold bg-white/50 px-2 py-0.5 rounded">주 {pkg.limit}회</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm font-semibold text-[var(--plana-primary)]">{pkg.amount}개</span>
                          <span className="text-sm font-bold text-[var(--plana-text-main)]">₩{pkg.cost.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 bg-white/50 rounded-lg p-1 w-max">
                          <button onClick={() => updateWeeklyPkg(pkg.name, Math.max(0, (selectedWeeklyPkgs[pkg.name] || 0) - 1))} className="w-8 h-8 rounded-md bg-white text-[var(--plana-text-main)] hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-primary-dark)] shadow-sm transition-colors font-bold text-lg flex items-center justify-center pb-1">-</button>
                          <span className="w-8 text-center font-bold text-[var(--plana-text-main)]">{selectedWeeklyPkgs[pkg.name] || 0}</span>
                          <button onClick={() => updateWeeklyPkg(pkg.name, Math.min(pkg.limit, (selectedWeeklyPkgs[pkg.name] || 0) + 1))} className="w-8 h-8 rounded-md bg-white text-[var(--plana-text-main)] hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-primary-dark)] shadow-sm transition-colors font-bold text-lg flex items-center justify-center pb-1">+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {packageTab === 'onetime' && (
                <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2 pb-4">
                  <div className="pt-1 pb-2 border-b-2 border-dashed border-[var(--plana-border)] mb-3 mt-1">
                    <span className="text-[13px] font-bold text-[var(--plana-primary-dark)]">초회 한정 패키지</span>
                  </div>
                  {ONE_TIME_PACKAGES.filter(p => p.isHot).map(pkg => (
                    <div key={pkg.name} className="flex items-center gap-4 bg-white/30 p-3 rounded-lg border border-transparent hover:border-[var(--plana-border)] transition-colors">
                      <div className="w-16 h-16 relative flex-shrink-0">
                        <Image src={getPackageImage(pkg.name)} alt={pkg.name} fill sizes="64px" className="object-contain drop-shadow-sm" />
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--plana-text-main)] text-[14px]">{pkg.name}</span>
                          </div>
                          <span className="text-[10px] text-[var(--plana-text-muted)] font-bold bg-white/50 px-2 py-0.5 rounded">
                            {pkg.limit === 999 ? '제한 없음' : `${pkg.limit}회 가능`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm font-semibold text-[var(--plana-primary)]">{pkg.amount}개</span>
                          <span className="text-sm font-bold text-[var(--plana-text-main)]">₩{pkg.cost.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 bg-white/50 rounded-lg p-1 w-max">
                          <button onClick={() => updateOneTimePkg(pkg.name, Math.max(0, (selectedOneTimePkgs[pkg.name] || 0) - 1))} className="w-8 h-8 rounded-md bg-white text-[var(--plana-text-main)] hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-primary-dark)] shadow-sm transition-colors font-bold text-lg flex items-center justify-center pb-1">-</button>
                          <span className="w-8 text-center font-bold text-[var(--plana-text-main)]">{selectedOneTimePkgs[pkg.name] || 0}</span>
                          <button onClick={() => updateOneTimePkg(pkg.name, Math.min(pkg.limit, (selectedOneTimePkgs[pkg.name] || 0) + 1))} className="w-8 h-8 rounded-md bg-white text-[var(--plana-text-main)] hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-primary-dark)] shadow-sm transition-colors font-bold text-lg flex items-center justify-center pb-1">+</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="pt-6 pb-2 border-b-2 border-dashed border-[var(--plana-border)] mb-3">
                    <span className="text-[13px] font-bold text-[var(--plana-primary-dark)]">일반 상시 패키지</span>
                  </div>
                  {ONE_TIME_PACKAGES.filter(p => !p.isHot).map(pkg => (
                    <div key={pkg.name} className="flex items-center gap-4 bg-white/30 p-3 rounded-lg border border-transparent hover:border-[var(--plana-border)] transition-colors">
                      <div className="w-16 h-16 relative flex-shrink-0">
                        <Image src={getPackageImage(pkg.name)} alt={pkg.name} fill sizes="64px" className="object-contain drop-shadow-sm" />
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--plana-text-main)] text-[14px]">{pkg.name}</span>
                          </div>
                          <span className="text-[10px] text-[var(--plana-text-muted)] font-bold bg-white/50 px-2 py-0.5 rounded">
                            {pkg.limit === 999 ? '제한 없음' : `${pkg.limit}회 가능`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm font-semibold text-[var(--plana-primary)]">{pkg.amount}개</span>
                          <span className="text-sm font-bold text-[var(--plana-text-main)]">₩{pkg.cost.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 bg-white/50 rounded-lg p-1 w-max">
                          <button onClick={() => updateOneTimePkg(pkg.name, Math.max(0, (selectedOneTimePkgs[pkg.name] || 0) - 1))} className="w-8 h-8 rounded-md bg-white text-[var(--plana-text-main)] hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-primary-dark)] shadow-sm transition-colors font-bold text-lg flex items-center justify-center pb-1">-</button>
                          <span className="w-8 text-center font-bold text-[var(--plana-text-main)]">{selectedOneTimePkgs[pkg.name] || 0}</span>
                          <button onClick={() => updateOneTimePkg(pkg.name, Math.min(pkg.limit, (selectedOneTimePkgs[pkg.name] || 0) + 1))} className="w-8 h-8 rounded-md bg-white text-[var(--plana-text-main)] hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-primary-dark)] shadow-sm transition-colors font-bold text-lg flex items-center justify-center pb-1">+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Results & Events */}
        <div className="xl:col-span-7 space-y-6">

          {/* Result Card */}
          <div className="glass-panel p-8 rounded-3xl flex items-center gap-8 relative">
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none z-0">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-[var(--plana-primary-light)]/20 rounded-full blur-2xl"></div>
              <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[var(--plana-accent)]/20 rounded-full blur-2xl"></div>
            </div>

            <div className="group w-28 h-28 relative flex-shrink-0 z-30 hover:scale-105 transition-transform duration-300 cursor-help">
              <Image src="/pyroxene.png" alt="Pyroxene" fill unoptimized sizes="112px" className="object-contain drop-shadow-md" />

              {/* Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none w-64 bg-white/95 backdrop-blur-sm shadow-xl rounded-xl p-4 border-2 border-[var(--plana-primary-light)] z-50">
                <p className="text-[12px] font-semibold text-[var(--plana-text-main)] leading-relaxed">
                  어른의 카드로 구입할 수 있는 신비한 보석.<br />
                  다양한 상품을 거래할 수 있다.<br />
                  <br />
                  파랑색 AI가 많이 좋아한다.
                </p>
              </div>
            </div>

            <div className="flex flex-col z-10 w-full">
              <span className="text-[var(--plana-text-muted)] text-lg font-semibold mb-1">예상 누적 청휘석</span>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-extrabold text-[var(--plana-text-main)] tracking-tight drop-shadow-sm">
                  {totalAmount.toLocaleString()}
                </span>
                <span className="text-xl font-bold text-[var(--plana-primary-dark)]">개</span>
              </div>
              <div className="w-full h-1 mt-4 bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-accent)] rounded-full opacity-50"></div>
            </div>
          </div>

          {/* Receipt Card */}
          {costBreakdown.length > 0 && (
            <div className="bg-[#f9f9f9] border border-gray-300 p-8 rounded shadow-sm relative font-mono text-gray-800 rotate-1 transform-gpu hover:rotate-0 transition-transform duration-300 max-w-lg mx-auto mt-6">
              <div className="absolute top-4 right-4 w-28 h-28 drop-shadow-md z-10">
                <Image src="/images/mass.png" alt="Stamp" fill unoptimized sizes="112px" className="object-contain" />
              </div>
              <div className="text-center mb-6 border-b-2 border-dashed border-gray-400 pb-6 mt-4">
                <h3 className="text-2xl font-bold mb-1 tracking-tight">어른의 카드 청구서</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest">SCHALE Invoice</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-xs text-gray-500 font-bold border-b border-gray-300 pb-2">
                  <span>ITEM</span>
                  <div className="flex gap-4 w-5/12 justify-end">
                    <span className="w-12 text-right">QTY</span>
                    <span className="w-24 text-right">AMOUNT</span>
                  </div>
                </div>
                {costBreakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                    <span className="font-medium truncate pr-4">{item.label}</span>
                    <div className="flex gap-4 w-5/12 justify-end whitespace-nowrap">
                      <span className="w-12 text-right text-gray-600">x{item.count}</span>
                      <span className="w-24 text-right">₩{(item.cost).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-dashed border-gray-400 pt-6 flex justify-between items-end">
                <span className="font-bold text-xl tracking-tight">TOTAL</span>
                <div className="text-right">
                  <span className="text-xs text-gray-500 block mb-1">KRW</span>
                  <span className="text-3xl font-extrabold text-[var(--plana-primary-dark)]">
                    ₩{totalCost.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Breakdown List */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-[var(--plana-text-main)] mb-4 flex items-center gap-2">
              <ListCollapse className="w-5 h-5 text-[var(--plana-primary-dark)]" />
              상세 내역 (총 {totalAmount.toLocaleString()}개)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {breakdown.map((item, idx) => (
                <div key={idx} className="bg-white/50 p-3 rounded-lg border border-[var(--plana-border)] flex justify-between items-center">
                  <span className="text-[13px] font-medium text-[var(--plana-text-muted)]">{item.label}</span>
                  <span className="text-[14px] font-bold text-[var(--plana-text-main)]">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Events List */}
          {activeEvents.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl fade-in-anim">
              <h3 className="text-lg font-bold text-[var(--plana-text-main)] mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--plana-primary-dark)]" />
                반영된 이벤트 스케줄
              </h3>
              <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                {activeEvents.map((ev, i) => (
                  <div key={i} className="flex flex-col bg-white/60 p-4 rounded-xl border border-[var(--plana-border)] hover:bg-white/80 transition-colors">
                    <span className="font-bold text-[var(--plana-text-main)] text-[15px]">{ev.name}</span>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[13px]">
                      <span className="text-[var(--plana-text-muted)] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--plana-accent)]"></span>
                        진행 기간: {formatDate(ev.startDate)} ~ {formatDate(ev.endDate)}
                      </span>
                      {!ev.name.includes('종합전술시험') && (
                        <span className="text-[var(--plana-primary-dark)] font-semibold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[var(--plana-primary)]"></span>
                          보상 수령일: {formatDate(ev.rewardDate)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Hidden Export Template */}
      <PyroxeneExportTemplate
        exportRef={exportRef}
        startDate={new Date(startDateStr)}
        targetDate={new Date(targetDateStr)}
        today={new Date()}
        breakdown={breakdown}
        costBreakdown={costBreakdown}
        totalCost={totalCost}
        totalAmount={totalAmount}
      />
    </div>
  );
}
