import { useState, useMemo } from 'react';
import { PyroxeneData, ScheduledEvent } from '@/lib/pyroxeneParser';

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

export function usePyroxeneCalc(data: PyroxeneData, events: ScheduledEvent[]) {
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

  const defaultTacRank = data.tacticalRanks.length > 0 ? data.tacticalRanks[data.tacticalRanks.length - 1].rank : '8001~15000';
  const [tacticalRank, setTacticalRank] = useState<string>(defaultTacRank);
  const [taTier, setTaTier] = useState<string>(data.totalAssaultTiers[0]?.name || '플래티넘');
  const [attendanceDay, setAttendanceDay] = useState<number>(1);

  const [selectedMonthlyPkgs, setSelectedMonthlyPkgs] = useState<Record<string, number>>({});
  const [selectedWeeklyPkgs, setSelectedWeeklyPkgs] = useState<Record<string, number>>({});
  const [selectedOneTimePkgs, setSelectedOneTimePkgs] = useState<Record<string, number>>({});

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
      if (d.getDate() === 1) monthlyPurchases++;
      if (d.getDay() === 1) mondayPurchases++;

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
    let totalCost = 0;
    const costBreakdown: { label: string; count: number; cost: number; perItem: number }[] = [];

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
        overlapDays = Math.min(overlapDays, 7); 
        const reward = overlapDays * 10;
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

  return {
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
  };
}
