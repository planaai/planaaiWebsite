'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { PyroxeneData, ScheduledEvent } from '@/lib/pyroxeneParser';
import { Calendar, Calculator, Sparkles, Settings, ListCollapse, ShoppingCart, Download } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

const ONE_TIME_PACKAGES = [
  { name: '청휘석 6600개 (초회)', amount: 6600, cost: 99000, limit: 3, isHot: true },
  { name: '청휘석 8000개 (초회)', amount: 8000, cost: 99000, limit: 1, isHot: true },
  { name: '청휘석 3920개 (초회)', amount: 3920, cost: 49000, limit: 1, isHot: true },
  { name: '청휘석 2352개 (초회)', amount: 2352, cost: 29000, limit: 1, isHot: true },
  { name: '청휘석 1184개 (초회)', amount: 1184, cost: 15000, limit: 1, isHot: true },
  { name: '청휘석 784개 (초회)', amount: 784, cost: 9900, limit: 1, isHot: true },
  { name: '청휘석 352개 (초회)', amount: 352, cost: 4400, limit: 1, isHot: true },
  { name: '청휘석 120개 (초회)', amount: 120, cost: 1500, limit: 1, isHot: true },
  { name: '청휘석 4800개', amount: 4800, cost: 99000, limit: 999, isHot: false },
  { name: '청휘석 2300개', amount: 2300, cost: 49000, limit: 999, isHot: false },
  { name: '청휘석 1350개', amount: 1350, cost: 29000, limit: 999, isHot: false },
  { name: '청휘석 660개', amount: 660, cost: 15000, limit: 999, isHot: false },
  { name: '청휘석 420개', amount: 420, cost: 9900, limit: 999, isHot: false },
  { name: '청휘석 179개', amount: 179, cost: 4400, limit: 999, isHot: false },
  { name: '청휘석 60개', amount: 60, cost: 1500, limit: 999, isHot: false }
];

interface Props {
  data: PyroxeneData;
  events: ScheduledEvent[];
}

export default function PyroxeneCalculator({ data, events }: Props) {
  const today = new Date();

  const [startDateStr, setStartDateStr] = useState<string>(
    today.toISOString().split('T')[0]
  );
  const startDate = useMemo(() => new Date(startDateStr), [startDateStr]);

  const defaultTargetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [targetDateStr, setTargetDateStr] = useState<string>(
    defaultTargetDate.toISOString().split('T')[0]
  );

  const targetDate = useMemo(() => new Date(targetDateStr), [targetDateStr]);

  // Personalization States
  const defaultTacRank = data.tacticalRanks.length > 0 ? data.tacticalRanks[data.tacticalRanks.length - 1].rank : '8001~15000';
  const [tacticalRank, setTacticalRank] = useState<string>(defaultTacRank);
  const [taTier, setTaTier] = useState<string>(data.totalAssaultTiers[0]?.name || '플래티넘');
  const [attendanceDay, setAttendanceDay] = useState<number>(1);

  const [selectedMonthlyPkgs, setSelectedMonthlyPkgs] = useState<Record<string, number>>({});
  const [selectedWeeklyPkgs, setSelectedWeeklyPkgs] = useState<Record<string, number>>({});
  const [selectedOneTimePkgs, setSelectedOneTimePkgs] = useState<Record<string, number>>({});
  const [packageTab, setPackageTab] = useState<'monthly' | 'weekly' | 'onetime'>('monthly');

  const exportRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);

    try {
      const dataUrl = await htmlToImage.toPng(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff'
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

  const { totalAmount, activeEvents, breakdown, totalCost, costBreakdown } = useMemo(() => {
    if (targetDate < startDate) return { totalAmount: 0, activeEvents: [], breakdown: [], totalCost: 0, costBreakdown: [] };

    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const diffWeeks = Math.floor(diffDays / 7);

    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDaysToStart = Math.max(0, Math.floor((start.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)));
    const startAttendanceDay = ((attendanceDay - 1 + diffDaysToStart) % 10) + 1;

    let monthlyPurchases = 0;
    let mondayPurchases = 0;
    let attendancePyroxene = 0;

    let currentAttDay = startAttendanceDay;

    for (let d = new Date(start); d <= target; d.setDate(d.getDate() + 1)) {
      // 1st of month logic
      if (d.getDate() === 1) monthlyPurchases++;

      // Monday logic
      if (d.getDay() === 1) mondayPurchases++;

      // Attendance logic
      if (currentAttDay === 5) attendancePyroxene += 50;
      else if (currentAttDay === 10) attendancePyroxene += 100;

      currentAttDay++;
      if (currentAttDay > 10) currentAttDay = 1;
    }

    const tacAmount = data.tacticalRanks.find(r => r.rank === tacticalRank)?.amount || 10;

    const dailyTotal = (data.dailyQuests + tacAmount) * diffDays;
    const weeklyTotal = data.weeklyQuests * diffWeeks;

    let upfrontTotal = 0;
    let dailyTotalFromPkgs = 0;

    Object.entries(selectedMonthlyPkgs).forEach(([name, count]) => {
      if (!count) return;
      if (name.includes('하프')) {
        upfrontTotal += 176 * monthlyPurchases * count;
        dailyTotalFromPkgs += 20 * diffDays * count;
      } else if (name === '월간 청휘석 패키지') {
        upfrontTotal += 392 * monthlyPurchases * count;
        dailyTotalFromPkgs += 40 * diffDays * count;
      } else if (name === '월간 청휘석 6600개') {
        upfrontTotal += 6600 * monthlyPurchases * count;
      }
    });


    let totalCost = 0;
    const costBreakdown: { label: string; count: number; cost: number; perItem: number }[] = [];

    Object.entries(selectedMonthlyPkgs).forEach(([name, count]) => {
      if (!count) return;
      const pkg = data.monthlyPackages.find(p => p.name === name);
      if (pkg) {
        const itemTotalCost = pkg.cost * monthlyPurchases * count;
        totalCost += itemTotalCost;
        if (itemTotalCost > 0) {
          costBreakdown.push({ label: name, count: monthlyPurchases * count, cost: itemTotalCost, perItem: pkg.cost });
        }
      }
    });

    let weeklyPkgTotal = 0;
    Object.entries(selectedWeeklyPkgs).forEach(([name, count]) => {
      if (!count) return;
      const pkg = data.weeklyPackages.find(p => p.name === name);
      if (pkg) {
        const purchases = name.includes('2주 AP') ? monthlyPurchases : mondayPurchases;

        if (name.includes('2주 AP')) {
          upfrontTotal += pkg.amount * monthlyPurchases * count;
        } else {
          weeklyPkgTotal += pkg.amount * mondayPurchases * count;
        }

        const itemTotalCost = pkg.cost * purchases * count;
        totalCost += itemTotalCost;
        if (itemTotalCost > 0) {
          costBreakdown.push({ label: name, count: purchases * count, cost: itemTotalCost, perItem: pkg.cost });
        }
      }
    });

    let oneTimeTotal = 0;
    Object.entries(selectedOneTimePkgs).forEach(([name, count]) => {
      if (!count) return;
      const pkg = ONE_TIME_PACKAGES.find(p => p.name === name);
      if (pkg) {
        oneTimeTotal += pkg.amount * count;
        const itemTotalCost = pkg.cost * count;
        totalCost += itemTotalCost;
        if (itemTotalCost > 0) {
          costBreakdown.push({ label: name, count: count, cost: itemTotalCost, perItem: pkg.cost });
        }
      }
    });

    let eventPyroxene = 0;
    const includedEvents: ScheduledEvent[] = [];

    // Breakdown parts
    let totalTa = 0;
    const eventDailyDetails: { name: string, days: number, reward: number }[] = [];

    events.forEach(event => {
      const eStart = new Date(event.startDate);
      const eEnd = new Date(event.endDate);
      const eReward = new Date(event.rewardDate);

      eStart.setHours(0, 0, 0, 0);
      eEnd.setHours(0, 0, 0, 0);
      eReward.setHours(0, 0, 0, 0);

      let isIncluded = false;

      const overlapStart = new Date(Math.max(start.getTime(), eStart.getTime()));
      const overlapEnd = new Date(Math.min(target.getTime(), eEnd.getTime()));

      if (overlapStart <= overlapEnd) {
        let overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        overlapDays = Math.min(overlapDays, 7); // Max 7 days
        const reward = overlapDays * 10; // 10 pyroxenes per day
        eventPyroxene += reward;
        eventDailyDetails.push({ name: event.name, days: overlapDays, reward });
        isIncluded = true;
      }

      if (eReward >= start && eReward <= target) {
        if (event.type === '총력전') {
          const tierReward = data.totalAssaultTiers.find(t => t.name === taTier)?.amount || 1200;
          const total = tierReward + data.assaultClearReward;
          eventPyroxene += total;
          totalTa += total;
          isIncluded = true;
        }
      }

      if (isIncluded) {
        includedEvents.push(event);
      }
    });

    const breakdownItems = [
      { label: `일일 퀘스트 (${diffDays}일)`, value: Math.floor(data.dailyQuests * diffDays) },
      { label: `전술대회 (${tacticalRank}등, ${diffDays}일)`, value: Math.floor(tacAmount * diffDays) },
      { label: `일반 출석 보상`, value: Math.floor(attendancePyroxene) },
      { label: `월정액 일일 지급 (${diffDays}일)`, value: Math.floor(dailyTotalFromPkgs) },
      { label: `주간 퀘스트 (${diffWeeks}주)`, value: Math.floor(weeklyTotal) },
      { label: `패키지 즉시 지급 (월초 ${monthlyPurchases}회)`, value: Math.floor(upfrontTotal) },
      { label: `주간 패키지 (월요일 ${mondayPurchases}회)`, value: Math.floor(weeklyPkgTotal) },
      { label: `단품 패키지 즉시 지급`, value: Math.floor(oneTimeTotal) },
      ...eventDailyDetails.map(ed => ({ label: `${ed.name} 일일 보상 (${ed.days}일)`, value: Math.floor(ed.reward) })),
      { label: `총력전 랭킹 (${taTier})`, value: Math.floor(totalTa) }
    ].filter(item => item.value > 0);

    const total = Math.floor(dailyTotal + weeklyTotal + dailyTotalFromPkgs + upfrontTotal + weeklyPkgTotal + eventPyroxene + oneTimeTotal + attendancePyroxene);
    return { totalAmount: total, activeEvents: includedEvents, breakdown: breakdownItems, totalCost, costBreakdown };
  }, [targetDateStr, startDate, data, events, tacticalRank, taTier, attendanceDay, selectedMonthlyPkgs, selectedWeeklyPkgs, selectedOneTimePkgs]);

  const sortedWeeklyPackages = useMemo(() => {
    return [...data.weeklyPackages].sort((a, b) => {
      const getWeight = (name: string, index: number) => {
        const match = name.match(/주간 장비 패키지 (I|II|III|IV|V|VI|VII|VIII|IX|X)$/);
        if (!match) return index;
        const map: any = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10 };
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

  const getPackageImage = (pkgName: string) => {
    const sanitizedName = pkgName.replace(' (초회)', ' 초회');
    return `/images/package/${sanitizedName}.png`;
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
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div
          ref={exportRef}
          className="bg-white p-10 w-[800px] relative font-sans text-gray-800"
          style={{ background: 'linear-gradient(to bottom right, #f4f7fb, #ffffff)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-[var(--plana-primary)] pb-4 mb-6">
            <div className="flex items-center gap-4">
              <img src="/pyroxene.png" alt="Pyroxene" className="w-16 h-16 object-contain drop-shadow-md" />
              <div>
                <h2 className="text-3xl font-bold text-[var(--plana-text-main)] tracking-tight">청휘석 계산 보고서</h2>
                <div className="flex gap-4 mt-1 text-[var(--plana-text-muted)] text-[13px]">
                  <p>결산 기간: {formatDate(startDate)} ~ {formatDate(targetDate)}</p>
                  <p>| 작성일: {formatDate(today)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Left: Pyroxene Breakdown */}
            <div>
              <h3 className="text-lg font-bold text-[var(--plana-text-main)] mb-3 border-b pb-2 flex items-center gap-2">
                <ListCollapse className="w-5 h-5" /> 청휘석 수급 상세
              </h3>
              <div className="space-y-2">
                {breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[13px] border-b border-gray-100 pb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-bold flex items-center gap-1">
                      {item.value.toLocaleString()}
                      <img src="/pyroxene.png" alt="pyroxene" className="w-4 h-4 object-contain" />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Receipt */}
            <div>
              {costBreakdown.length > 0 ? (
                <div className="bg-[#f9f9f9] border border-gray-300 p-6 rounded shadow-sm relative font-mono text-gray-800 rotate-1 max-w-sm mx-auto">
                  <div className="absolute top-2 right-2 w-16 h-16 drop-shadow-md z-10">
                    <img src="/images/mass.png" alt="Stamp" className="w-full h-full object-contain" />
                  </div>
                  <div className="text-center mb-4 border-b-2 border-dashed border-gray-400 pb-4 mt-2">
                    <h4 className="text-xl font-bold mb-1 tracking-tight">어른의 카드 청구서</h4>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">SCHALE Invoice</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-[10px] text-gray-500 font-bold border-b border-gray-300 pb-1">
                      <span>ITEM</span>
                      <div className="flex gap-2 w-7/12 justify-end">
                        <span className="w-8 text-right">QTY</span>
                        <span className="w-20 text-right">AMOUNT</span>
                      </div>
                    </div>
                    {costBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] border-b border-gray-100 pb-1">
                        <span className="font-medium truncate pr-2">{item.label}</span>
                        <div className="flex gap-2 w-7/12 justify-end whitespace-nowrap">
                          <span className="w-8 text-right text-gray-600">x{item.count}</span>
                          <span className="w-20 text-right">₩{(item.cost).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t-2 border-dashed border-gray-400 pt-4 flex justify-between items-end">
                    <span className="font-bold text-lg tracking-tight">TOTAL</span>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 block mb-0.5">KRW</span>
                      <span className="text-xl font-extrabold text-[var(--plana-primary-dark)]">
                        ₩{totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--plana-text-muted)] text-sm border-2 border-dashed border-gray-300 bg-white/30 rounded-lg p-6 text-center font-bold">
                  [보고서 가이드]<br />청구서를 여기에 부착해 주세요.
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 border-t-2 border-[var(--plana-primary)] pt-4 flex justify-between items-end">
            <div className="text-sm text-[var(--plana-text-muted)] font-bold flex items-center relative">
              <span className="relative z-10">문서 작성자 : 프라나</span>
              <div className="w-14 h-14 absolute -top-[26px] -right-12 -rotate-12 opacity-90 drop-shadow-sm">
                <img src="/images/plana_stamp.png" alt="Plana Stamp" className="w-full h-full object-contain scale-x-[-1]" />
              </div>
            </div>
            <div className="text-right text-[var(--plana-primary-dark)]">
              <p className="text-sm font-bold mb-1">예상 누적 청휘석</p>
              <p className="text-4xl font-extrabold flex items-center justify-end gap-2">
                {totalAmount.toLocaleString()}
                <img src="/pyroxene.png" alt="pyroxene" className="w-8 h-8 object-contain" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
