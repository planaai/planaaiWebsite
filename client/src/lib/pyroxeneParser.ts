export interface PackageOption {
  name: string;
  limit: number;
  amount: number;
  cost: number;
}

export interface TierOption {
  name: string;
  amount: number;
}

export interface RankOption {
  rank: string;
  amount: number;
}

export interface PyroxeneData {
  dailyQuests: number;
  weeklyQuests: number;
  assaultClearReward: number;
  tacticalRanks: RankOption[];
  totalAssaultTiers: TierOption[];
  grandAssaultTiers: TierOption[];
  monthlyPackages: PackageOption[];
  weeklyPackages: PackageOption[];
}

export interface ScheduledEvent {
  name: string;
  type: '총력전' | '대결전' | '종합전술시험';
  startDate: Date;
  endDate: Date;
  rewardDate: Date;
}

const STATIC_PYROXENE_DATA: PyroxeneData = {
  dailyQuests: 20,
  weeklyQuests: 120,
  assaultClearReward: 650,
  monthlyPackages: [
    { name: '월간 청휘석 6600개', limit: 5, amount: 6600, cost: 99000 },
    { name: '월간 청휘석 패키지', limit: 1, amount: 1592, cost: 9900 },
    { name: '하프 월간 청휘석 패키지', limit: 1, amount: 776, cost: 4400 },
  ],
  weeklyPackages: [
    { name: '2주 AP 패키지', limit: 2, amount: 176, cost: 4400 },
    { name: '주간 활동 보고서 패키지 III', limit: 3, amount: 800, cost: 19000 },
    { name: '신임교사용 활동 보고서 패키지 III', limit: 1, amount: 192, cost: 4400 },
    { name: '주간 장비 패키지 VII', limit: 1, amount: 784, cost: 19000 },
    { name: '주간 장비 패키지 VI', limit: 1, amount: 784, cost: 19000 },
    { name: '주간 장비 패키지 V', limit: 1, amount: 784, cost: 19000 },
    { name: '주간 장비 패키지 IV', limit: 1, amount: 784, cost: 19000 },
    { name: '주간 장비 패키지 III', limit: 1, amount: 784, cost: 19000 },
    { name: '주간 장비 패키지 II', limit: 1, amount: 784, cost: 19000 },
    { name: '주간 장비 패키지 I', limit: 1, amount: 392, cost: 9900 },
  ],
  totalAssaultTiers: [
    { name: '플래티넘', amount: 1200 },
    { name: '골드', amount: 1000 },
    { name: '실버', amount: 800 },
    { name: '브론즈', amount: 600 },
  ],
  grandAssaultTiers: [
    { name: '플래티넘', amount: 1200 },
    { name: '골드', amount: 1200 },
    { name: '실버', amount: 1200 },
    { name: '브론즈', amount: 1200 },
  ],
  tacticalRanks: [
    { rank: '1', amount: 45 },
    { rank: '2', amount: 40 },
    { rank: '3~10', amount: 35 },
    { rank: '11~100', amount: 30 },
    { rank: '101~200', amount: 25 },
    { rank: '201~500', amount: 20 },
    { rank: '501~1000', amount: 18 },
    { rank: '1001~2000', amount: 16 },
    { rank: '2001~4000', amount: 14 },
    { rank: '4001~8000', amount: 12 },
    { rank: '8001~15000', amount: 10 },
  ],
};

export function getPyroxeneData(): PyroxeneData {
  return STATIC_PYROXENE_DATA;
}

export async function fetchScheduledEvents(): Promise<ScheduledEvent[]> {
  const url =
    'https://docs.google.com/spreadsheets/d/1frtGAJ2q5X-rTkUxE2sdMzp0VCuMjgulwTdZ5aBTi28/export?format=csv&gid=672251043';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, {
      next: { revalidate: 2592000 }, // Cache for 30 days
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (!res || !res.ok) {
      return [];
    }

    const text = await res.text();
    const events: ScheduledEvent[] = [];

    // Match (MM/DD ~ MM/DD hh:mm) EventName(총력전|대결전|종합전술시험)
    const regex =
      /\((\d{1,2})\/(\d{1,2})\s*~\s*(\d{1,2})\/(\d{1,2})\s*(?:\d+:\d+)?\)\s*([^\n]*?(총력전|대결전|종합전술시험))/g;

    let match;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    while ((match = regex.exec(text)) !== null) {
      const startMonth = parseInt(match[1]);
      const startDay = parseInt(match[2]);
      const endMonth = parseInt(match[3]);
      const endDay = parseInt(match[4]);
      const eventFullName = match[5].trim();

      let eventType: '총력전' | '대결전' | '종합전술시험' = '총력전';
      if (match[6] === '대결전') eventType = '대결전';
      if (match[6] === '종합전술시험') eventType = '종합전술시험';

      let sYear = currentYear;
      let eYear = currentYear;

      if (endMonth < startMonth) {
        eYear++;
      }

      if (startMonth < currentMonth - 2) {
        sYear++;
        eYear++;
      }

      const startDate = new Date(sYear, startMonth - 1, startDay);
      const endDate = new Date(eYear, endMonth - 1, endDay);

      // Reward date is exactly 2 days after end date
      const rewardDate = new Date(endDate);
      rewardDate.setDate(rewardDate.getDate() + 2);

      events.push({
        name: eventFullName,
        type: eventType,
        startDate,
        endDate,
        rewardDate,
      });
    }

    return events;
  } catch (error) {
    // Offline / DNS error recovery for static prerendering
    console.warn('Failed to fetch schedule from Google Sheets, returning empty fallback:', error);
    return [];
  }
}
