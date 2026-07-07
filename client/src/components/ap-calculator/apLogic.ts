import { addMinutes, subHours, subMinutes, differenceInMinutes } from 'date-fns';

export interface ApTimelineStep {
  time: Date;
  action: string;
  description: string;
  isImportant?: boolean;
  barAp?: number;
  mailboxAp?: number;
  mailboxDetails?: { name: string; amount: number }[];
}

export interface ApCalculationResult {
  isPossible: boolean;
  totalHoardedAp: number;
  timeline: ApTimelineStep[];
  errorMessage?: string;
}

export function calculateApSchedule(
  targetDate: Date,
  currentAp: number,
  cafeAp: number,
  useDailyQuest: boolean,
  pvpRefreshes: number,
  targetPyroxeneRefreshes: number,
  useApPackage: boolean,
  userLevel: number = 90,
  bufferHours: number = 23.5, 
  hoardingDays: number = 1,
  todayAttendance: number = 0,
  useWeeklyQuest: boolean = true
): ApCalculationResult {
  const now = new Date();
  if (targetDate <= now) {
    return { isPossible: false, totalHoardedAp: 0, timeline: [], errorMessage: '목표 시간은 현재 시간보다 미래여야 합니다.' };
  }

  const mailboxTime = subHours(targetDate, bufferHours);
  if (mailboxTime <= now) {
    return { 
      isPossible: false, 
      totalHoardedAp: 0, 
      timeline: [], 
      errorMessage: `목표 시간까지 남은 시간이 너무 짧습니다. (최소 ${bufferHours}시간 이상 필요)` 
    };
  }

  let maxAp = 240;
  if (userLevel <= 20) {
    maxAp = 24 + (userLevel - 1) * 4;
  } else {
    maxAp = 100 + (userLevel - 20) * 2;
  }

  const pvpAp = pvpRefreshes * 90;
  const pyroxeneAp = targetPyroxeneRefreshes * 120;
  
  const lastCharge = pyroxeneAp > 0 ? 120 : (pvpAp > 0 ? 90 : 0);
  const totalCharge = pvpAp + pyroxeneAp;
  let optimalStartAp = 998 - totalCharge + lastCharge;
  if (useApPackage) optimalStartAp -= 150; 
  
  const targetNaturalAp = Math.max(0, Math.min(maxAp, optimalStartAp));
  const minutesNeeded = targetNaturalAp * 6;
  const startHoardTime = subMinutes(mailboxTime, minutesNeeded);

  const timeline: ApTimelineStep[] = [];
  
  if (startHoardTime > now) {
    timeline.push({
      time: startHoardTime,
      action: '존버 시작 (AP 소모 중단)',
      description: `이 시점까지 AP를 자유롭게 쓰다가 0 근처로 비우세요.\n이후 자연 회복으로 목표치(${targetNaturalAp} AP)를 모읍니다.`,
      barAp: 0,
      mailboxAp: 0
    });
  } else {
    const naturalRegen = Math.floor(differenceInMinutes(mailboxTime, now) / 6);
    timeline.push({
      time: now,
      action: '즉시 존버 시작',
      description: `지금부터 우편함 작업 시간까지 자연 회복을 최대한 모읍니다.\n(현재 ${currentAp} AP, 추가 회복 예상량 ${naturalRegen} AP)`,
      barAp: currentAp,
      mailboxAp: 0
    });
  }

  let barAp = startHoardTime > now ? targetNaturalAp : Math.min(maxAp, currentAp + Math.floor(differenceInMinutes(mailboxTime, now) / 6));
  let mailboxAp = 0;
  let hoardedAp = 0; 
  const mailboxDetails: { name: string; amount: number }[] = [];

  const addToMailbox = (name: string, amount: number) => {
    if (amount <= 0) return;
    const existing = mailboxDetails.find(i => i.name === name);
    if (existing) {
      existing.amount += amount;
    } else {
      mailboxDetails.push({ name, amount });
    }
  };

  timeline.push({
    time: mailboxTime,
    action: 'D-1 우편함 작업 시작 (로그인)',
    description: `접속 시 자연 회복된 분량인 ${barAp} AP 보유`,
    barAp, mailboxAp, mailboxDetails: [...mailboxDetails]
  });

  let timeOffset = 1;

  if (useApPackage) {
    const toBar = Math.min(150, Math.max(0, 999 - barAp));
    const toMailbox = 150 - toBar;
    barAp += toBar;
    hoardedAp += toMailbox; 
    addToMailbox('2주 AP 패키지', toMailbox);
    timeline.push({
      time: addMinutes(mailboxTime, timeOffset++),
      action: '2주 AP 패키지 자동 수령',
      description: '접속과 동시에 자동으로 수령됩니다.',
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: [...mailboxDetails]
    });
  }

  if (pvpRefreshes > 0 || targetPyroxeneRefreshes > 0) {
    let remainingPvp = pvpRefreshes;
    let remainingPyro = targetPyroxeneRefreshes;
    let pvpSpent = 0;
    let pyroSpent = 0;
    let addedPvpToMailbox = 0;
    let addedPyroToMailbox = 0;

    while (remainingPvp > 0 && barAp < 999) {
      const toBar = Math.min(90, 999 - barAp);
      barAp += toBar;
      mailboxAp += (90 - toBar);
      addedPvpToMailbox += (90 - toBar);
      remainingPvp--;
      pvpSpent++;
    }

    while (remainingPyro > 0 && barAp < 999) {
      const toBar = Math.min(120, 999 - barAp);
      barAp += toBar;
      mailboxAp += (120 - toBar);
      addedPyroToMailbox += (120 - toBar);
      remainingPyro--;
      pyroSpent++;
    }

    addToMailbox('전술대회 상점 코인', addedPvpToMailbox);
    addToMailbox('청휘석 AP 충전', addedPyroToMailbox);

    let desc = '';
    if (pvpSpent > 0) desc += `대항전 코인 ${pvpSpent}회(${pvpSpent * 90} AP) 구매.\n`;
    if (pyroSpent > 0) desc += `AP 충전 ${pyroSpent}회(${pyroSpent * 120} AP) 획득.\n`;
    if (remainingPvp > 0 || remainingPyro > 0) desc += `(999 AP 상한에 막혀 남은 횟수는 구매 실패)\n`;

    timeline.push({
      time: addMinutes(mailboxTime, timeOffset++),
      action: 'AP 충전 및 구매',
      description: desc.trim(),
      isImportant: true,
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: [...mailboxDetails]
    });
  }

  if (cafeAp > 0) {
    const toBar = Math.min(cafeAp, Math.max(0, 999 - barAp));
    barAp += toBar;
    mailboxAp += (cafeAp - toBar);
    addToMailbox('카페 AP', cafeAp - toBar);
    timeline.push({
      time: addMinutes(mailboxTime, timeOffset++),
      action: '카페 AP 수거',
      description: `카페 AP ${cafeAp} 수거 (우편함 보관)`,
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: [...mailboxDetails]
    });
  }

  if (useDailyQuest) {
    const toBar = Math.min(150, Math.max(0, 999 - barAp));
    barAp += toBar;
    mailboxAp += (150 - toBar);
    addToMailbox('일일 미션', 150 - toBar);
    timeline.push({
      time: addMinutes(mailboxTime, timeOffset++),
      action: '일일 미션 AP 수령',
      description: `일일 미션 보상 150 AP 수령 (우편함 보관)`,
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: [...mailboxDetails]
    });
  }

  if (todayAttendance > 0) {
    const toBar = Math.min(150, Math.max(0, 999 - barAp));
    barAp += toBar;
    hoardedAp += (150 - toBar);
    addToMailbox(`출석부 ${todayAttendance}일차`, 150 - toBar);
    timeline.push({
      time: addMinutes(mailboxTime, timeOffset++),
      action: `출석부 ${todayAttendance}일차 AP 수령`,
      description: `출석 보상 150 AP 수령 (우편함 보관)`,
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: [...mailboxDetails]
    });
  }

  let dDayTime = subMinutes(targetDate, 30);
  if (dDayTime <= mailboxTime) dDayTime = addMinutes(mailboxTime, 10);

  timeline.push({
    time: dDayTime,
    action: 'D-Day 이벤트 당일 (우편함 작업)',
    description: `1. 보유 중인 999 AP를 먼저 소모하세요.\n2. 우편함에 누적된 존버 AP를 꺼내서 소모하세요.\n3. 아래 나오는 당일 자원들을 '수령 -> 소모' 순서로 반복 처리하세요.`,
    isImportant: true,
    barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: [...mailboxDetails]
  });

  let dDayTotal = barAp + mailboxAp + hoardedAp;
  let dDayDesc = `접속 시 ${barAp} AP 보유\\n우편함 존버 물량 ${mailboxAp + hoardedAp} AP\\n`;

  let dDayTimeOffset = 1;

  if (useApPackage) {
    dDayTotal += 150;
    dDayDesc += `2주 AP 패키지 당일분 수령 -> 150 AP\n`;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 2주 패키지 수령',
      description: `2주 AP 패키지 당일분 150 AP 수령`,
      barAp: 999, mailboxAp: dDayTotal - 999
    });
  }

  if (cafeAp > 0) {
    dDayTotal += cafeAp;
    dDayDesc += `당일 카페 AP 수거 -> ${cafeAp} AP\n`;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 카페 수거',
      description: `카페 AP ${cafeAp} 수거`,
      barAp: 999, mailboxAp: dDayTotal - 999
    });
  }

  if (useDailyQuest) {
    dDayTotal += 150;
    dDayDesc += `당일 일일 미션 수령 -> 150 AP\n`;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 일일 미션 수령',
      description: `일일 미션 보상 150 AP 수령`,
      barAp: 999, mailboxAp: dDayTotal - 999
    });
  }

  let canUseWeeklyQuest = useWeeklyQuest;
  if (useWeeklyQuest) {
    const day = targetDate.getDay();
    const hours = targetDate.getHours();
    // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    if (day >= 2 && day <= 4) { 
      canUseWeeklyQuest = false; // 화~목 불가
    } else if (day === 1 && hours >= 4) { 
      canUseWeeklyQuest = false; // 월요일 04:00 이후 불가
    }
  }

  if (canUseWeeklyQuest) {
    dDayTotal += 200;
    dDayDesc += `당일 주간 미션 수령 -> 200 AP\\n`;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 주간 미션 수령',
      description: `주간 미션 보상 200 AP 수령`,
      barAp: 999, mailboxAp: dDayTotal - 999
    });
  } else if (useWeeklyQuest) {
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '주간 미션 수령 불가',
      description: `목표 요일 특성상 주간 미션(5일 접속)을 달성/수령할 수 없습니다.\n(수령 가능 시간: 금요일 ~ 월요일 03:59)`,
      barAp: 999, mailboxAp: dDayTotal - 999
    });
  }

  if (pvpRefreshes > 0) {
    const dDayPvp = pvpRefreshes * 90;
    dDayTotal += dDayPvp;
    dDayDesc += `당일 대항전 구매 -> ${dDayPvp} AP\n`;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 대항전 코인 구매',
      description: `대항전 코인 ${pvpRefreshes}회 구매 (${dDayPvp} AP)`,
      barAp: 999, mailboxAp: dDayTotal - 999
    });
  }

  timeline.push({
    time: targetDate,
    action: '모든 AP 소모 완료',
    description: `최종 획득 가능 AP: ${dDayTotal} AP`,
    isImportant: true,
    barAp: 0, mailboxAp: 0
  });

  return { 
    isPossible: true, 
    totalHoardedAp: dDayTotal, 
    timeline 
  };
}
