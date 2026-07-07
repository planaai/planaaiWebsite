import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

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

// Simple in-memory cache
let cachedData: PyroxeneData | null = null;

export function getPyroxeneData(): PyroxeneData {
  if (cachedData) return cachedData;

  const filePath = path.join(process.cwd(), '../data/청휘석 수급량.xlsx');
  
  if (!fs.existsSync(filePath)) {
    // Fallback if file not found
    return {
      dailyQuests: 20,
      weeklyQuests: 120,
      assaultClearReward: 650,
      tacticalRanks: [{ rank: '8001~15000', amount: 10 }],
      totalAssaultTiers: [{ name: '플래티넘', amount: 1200 }],
      grandAssaultTiers: [{ name: '플래티넘', amount: 1200 }],
      monthlyPackages: [],
      weeklyPackages: []
    };
  }

  const fileBuffer = fs.readFileSync(filePath);
  const wb = xlsx.read(fileBuffer);
  
  // 1. Daily/Weekly Quests
  const dailySheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['일반적 수급량']);
  const dailyQuests = dailySheet.find(row => row['수급 방법'] === '일일 퀘스트')?.['청휘석 량'] || 20;
  const weeklyQuests = dailySheet.find(row => row['수급 방법'] === '주간 퀘스트')?.['청휘석 량'] || 120;

  // 2. Packages
  const parsePackage = (row: any /* eslint-disable-line @typescript-eslint/no-explicit-any */): PackageOption => ({
    name: row['패키지명'],
    limit: row['구매 가능 횟수'] || 1,
    amount: row['수급량'] || 0,
    cost: row['어른의 카드 청구서'] || 0
  });

  const monthlyPkgSheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['패키지를 통한 월간 수급량']);
  const monthlyPackages = monthlyPkgSheet.filter(row => row['패키지명']).map(parsePackage);

  const weeklyPkgSheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['패키지를 통한 주간 수급량']);
  const weeklyPackages = weeklyPkgSheet.filter(row => row['패키지명']).map(parsePackage);

  // 3. Assault Tiers
  const parseTier = (row: any /* eslint-disable-line @typescript-eslint/no-explicit-any */): TierOption => ({
    name: row['항목'],
    amount: row['수급량'] || 0
  });

  const totalAssaultSheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['총력전 월간 청휘석 수급량']);
  const totalAssaultTiers = totalAssaultSheet
    .filter(row => row['항목'] && row['항목'] !== '누적 포인트 보상 올클리어')
    .map(parseTier);
    
  const grandAssaultSheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['대결전 월간 청휘석 수급량']);
  const grandAssaultTiers = grandAssaultSheet
    .filter(row => row['항목'] && row['항목'] !== '누적 포인트 보상 올클리어')
    .map(parseTier);

  const assaultClearReward = totalAssaultSheet.find(row => row['항목'] === '누적 포인트 보상 올클리어')?.['수급량'] || 650;

  // 4. Tactical Challenge Ranks
  const tacticalSheet = xlsx.utils.sheet_to_json<any>(wb.Sheets['전술대회 일간 청휘석 수급량']);
  const tacticalRanks: RankOption[] = tacticalSheet.map(row => {
    // Columns were parsed as '1' (rank string) and '45' (amount) due to no header in excel
    // The keys are exactly what we got from dump: '1' for string, '45' for amount
    const keys = Object.keys(row);
    return {
      rank: String(row[keys[0]]),
      amount: Number(row[keys[1]])
    };
  });

  cachedData = {
    dailyQuests,
    weeklyQuests,
    assaultClearReward,
    tacticalRanks,
    totalAssaultTiers,
    grandAssaultTiers,
    monthlyPackages,
    weeklyPackages
  };

  return cachedData;
}

export async function fetchScheduledEvents(): Promise<ScheduledEvent[]> {
  const url = 'https://docs.google.com/spreadsheets/d/1frtGAJ2q5X-rTkUxE2sdMzp0VCuMjgulwTdZ5aBTi28/export?format=csv&gid=370752835';
  
  try {
    const res = await fetch(url, {
      next: { revalidate: 2592000 } // Cache for 30 days
    });
    
    if (!res.ok) {
      console.error('Failed to fetch schedule data');
      return [];
    }
    
    const text = await res.text();
    const events: ScheduledEvent[] = [];
    
    // Match (MM/DD ~ MM/DD hh:mm) EventName(총력전|대결전|종합전술시험)
    const regex = /\((\d{1,2})\/(\d{1,2})\s*~\s*(\d{1,2})\/(\d{1,2})\s*(?:\d+:\d+)?\)\s*([^\n]*?(총력전|대결전|종합전술시험))/g;
    
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
      
      // Reward date is exactly 2 days after end date as requested
      const rewardDate = new Date(endDate);
      rewardDate.setDate(rewardDate.getDate() + 2);
      
      events.push({
        name: eventFullName,
        type: eventType,
        startDate,
        endDate,
        rewardDate
      });
    }
    
    return events;
  } catch (error) {
    console.error('Error fetching schedule', error);
    return [];
  }
}
