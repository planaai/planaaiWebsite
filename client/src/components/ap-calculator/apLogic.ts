import { addMinutes, addHours, addDays, subHours, subMinutes, subDays, differenceInMinutes, format as fnsFormat, startOfDay } from 'date-fns';

export interface MailboxExpiryItem {
  name: string;
  amount: number;
  expiresAt: Date;
}

export interface ApTimelineStep {
  time: Date;
  action: string;
  description: string;
  isImportant?: boolean;
  isWarning?: boolean;
  barAp?: number;
  mailboxAp?: number;
  mailboxDetails?: { name: string; amount: number }[];
  dayLabel?: string; // e.g. "7월 20일 (토)"
  mailboxExpiryDetails?: MailboxExpiryItem[];
}

export interface ApCalculationResult {
  isPossible: boolean;
  totalHoardedAp: number;
  timeline: ApTimelineStep[];
  errorMessage?: string;
  isRetroactive?: boolean;
  warningMessage?: string;
  earliestMailboxExpiry?: Date;
  mailboxExpiryWarnings?: MailboxExpiryItem[];
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function getDayLabel(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dayName = DAY_NAMES[date.getDay()];
  return `${m}월 ${d}일 (${dayName})`;
}

/**
 * 블루아카이브 서버 리셋 시간은 04:00 KST.
 * "게임 날짜" 기준으로 서버 리셋 시간을 반환.
 */
function getServerResetTime(date: Date): Date {
  const reset = startOfDay(date);
  reset.setHours(4, 0, 0, 0);
  // date가 00:00~03:59 사이라면 이 리셋은 "오늘 04:00"이므로 그대로
  // date가 04:00 이후라면 다음 날 04:00이 다음 리셋
  if (date.getHours() >= 4) {
    return addDays(reset, 1);
  }
  return reset;
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
  useWeeklyQuest: boolean = true,
  useTr4DailyQuest: boolean = false
): ApCalculationResult {
  let now = new Date();
  let isRetroactive = false;
  let warningMessage: string | undefined = undefined;

  if (targetDate <= now) {
    isRetroactive = true;
    warningMessage = "⏪ 이 결과는 과거 시점 기준 시뮬레이션입니다. 실제 진행 상황과 다를 수 있습니다.";
    // 가상 now 역산: 목표 시간 - (필요 존버 시간 + 버퍼 타임)
    const totalHoursToSubtract = (hoardingDays * 24) + bufferHours;
    now = subMinutes(targetDate, totalHoursToSubtract * 60);
  }

  // 최소 필요 시간 = hoardingDays * 24시간 정도
  const minHoursNeeded = hoardingDays * 24;
  const hoursUntilTarget = differenceInMinutes(targetDate, now) / 60;
  if (!isRetroactive && hoursUntilTarget < minHoursNeeded) {
    warningMessage = `${hoardingDays}일 존버를 위해 최소 ${minHoursNeeded}시간 이상 남아야 하지만, 현재 ${Math.floor(hoursUntilTarget)}시간 남아있습니다. 참고용으로 계산되었습니다.`;
    // 가상 now 역산 (시간이 부족하더라도 풀 스케줄을 재현하기 위함)
    const totalHoursToSubtract = (hoardingDays * 24) + bufferHours;
    now = subMinutes(targetDate, totalHoursToSubtract * 60);
  }

  // maxAp 계산
  let maxAp = 240;
  if (userLevel <= 20) {
    maxAp = 24 + (userLevel - 1) * 4;
  } else {
    maxAp = 100 + (userLevel - 20) * 2;
  }

  const timeline: ApTimelineStep[] = [];
  const allMailboxExpiry: MailboxExpiryItem[] = [];

  // 우편함 추적용 state
  let barAp = 0;
  let mailboxAp = 0;
  const mailboxDetails: { name: string; amount: number }[] = [];

  const addToMailbox = (name: string, amount: number, time: Date) => {
    if (amount <= 0) return;
    const existing = mailboxDetails.find(i => i.name === name);
    if (existing) {
      existing.amount += amount;
    } else {
      mailboxDetails.push({ name, amount });
    }
    mailboxAp += amount;
    // 우편함 만료 = 입금 시점 + 24시간
    allMailboxExpiry.push({ name, amount, expiresAt: addHours(time, 24) });
  };

  const cloneMailboxDetails = () => mailboxDetails.map(i => ({ ...i }));
  const totalMailbox = () => mailboxAp;

  // ═══════════════════════════════════════════════
  // hoardingDays에 따라 D-N ~ D-Day 타임라인 생성
  // ═══════════════════════════════════════════════

  if (hoardingDays === 1) {
    // ── 기존 1일 존버 로직 ──
    const res = calculate1Day(targetDate, currentAp, cafeAp, useDailyQuest, pvpRefreshes,
      targetPyroxeneRefreshes, useApPackage, userLevel, maxAp, bufferHours,
      todayAttendance, useWeeklyQuest, now, allMailboxExpiry);
    if (isRetroactive) res.isRetroactive = isRetroactive;
    if (warningMessage) res.warningMessage = warningMessage;
    return res;
  }

  // ── 2일/3일 존버 로직 ──
  // D-Day 기준으로 역산
  // D-Day = targetDate (이벤트 시작/점검 종료 시간)
  // D-1 = targetDate - 1일 (23:59분에 TR-4 등 작업)
  // D-2 = targetDate - 2일
  // D-3 = targetDate - 3일 (3일 존버 시)

  // 존버 시작일: D-(hoardingDays)
  // 예: 3일 존버 → D-3에 존버 시작
  const dDayDate = targetDate;

  // 각 날짜의 로그인 시간 계산
  // D-Day 전날들은 23:59 이내 접속 기준
  // 존버 시작일은 자연 회복 시작 기준

  // ── 존버 시작일 (D-hoardingDays) ──
  const hoardStartDate = subDays(dDayDate, hoardingDays);
  const hoardStartDayLabel = getDayLabel(hoardStartDate);

  // 존버 시작일: AP 소진 + 자연 회복 시작
  // 다음 날 로그인(D-(hoardingDays-1))까지 자연 회복
  const nextDayLogin = subDays(dDayDate, hoardingDays - 1);
  // 다음 날 로그인 시간: 23:59 이내이므로 대략 그 날의 저녁으로 설정
  const nextDayLoginTime = new Date(nextDayLogin);
  nextDayLoginTime.setHours(23, 50, 0, 0); // 23:50 접속 가정

  // 자연 회복 가능 AP 계산 (존버 시작 → 다음 날 로그인까지)
  // 존버 시작 시점: 자연회복이 적절히 모이도록 역산
  const pvpAp = pvpRefreshes * 90;
  const pyroxeneAp = targetPyroxeneRefreshes * 120;
  const lastCharge = pyroxeneAp > 0 ? 120 : (pvpAp > 0 ? 90 : 0);
  const totalCharge = pvpAp + pyroxeneAp;
  let optimalStartAp = 998 - totalCharge + lastCharge;
  if (useApPackage) optimalStartAp -= 150;
  const targetNaturalAp = Math.max(0, Math.min(maxAp, optimalStartAp));
  const minutesNeeded = targetNaturalAp * 6;

  // 첫 번째 로그인 시간 (D-(hoardingDays-1))
  const firstLoginTime = new Date(subDays(dDayDate, hoardingDays - 1));
  firstLoginTime.setHours(23, 50, 0, 0);

  const startHoardTime = subMinutes(firstLoginTime, minutesNeeded);

  // 존버 시작 스텝
  if (startHoardTime > now) {
    timeline.push({
      time: startHoardTime,
      action: '존버 시작 (AP 소모 중단)',
      description: `이 시점까지 AP를 자유롭게 쓰다가 0 근처로 비우세요.\n이후 자연 회복으로 목표치(${targetNaturalAp} AP)를 모읍니다.`,
      barAp: 0,
      mailboxAp: 0,
      dayLabel: hoardStartDayLabel
    });
    barAp = 0;
  } else {
    const naturalRegen = Math.floor(differenceInMinutes(firstLoginTime, now) / 6);
    timeline.push({
      time: now,
      action: '즉시 존버 시작',
      description: `지금부터 자연 회복을 최대한 모읍니다.\n(현재 ${currentAp} AP, 추가 회복 예상량 ${naturalRegen} AP)`,
      barAp: currentAp,
      mailboxAp: 0,
      dayLabel: hoardStartDayLabel
    });
    barAp = currentAp;
  }

  // ── 중간일 루프 (D-(hoardingDays-1) ~ D-1) ──
  for (let dayOffset = hoardingDays - 1; dayOffset >= 1; dayOffset--) {
    const currentDate = subDays(dDayDate, dayOffset);
    const currentDayLabel = getDayLabel(currentDate);
    const loginTime = new Date(currentDate);
    loginTime.setHours(23, 50, 0, 0);

    // 첫 중간일: 자연 회복으로 모인 AP
    if (dayOffset === hoardingDays - 1) {
      barAp = startHoardTime > now ? targetNaturalAp : Math.min(maxAp, currentAp + Math.floor(differenceInMinutes(loginTime, now) / 6));
    }

    let timeOffset = 1;

    // 로그인 스텝
    const loginDesc = dayOffset === hoardingDays - 1
      ? `접속 시 자연 회복된 분량인 ${barAp} AP 보유`
      : `접속 시 ${barAp} AP 보유`;

    timeline.push({
      time: loginTime,
      action: `D-${dayOffset} 접속 (23:59 이내)`,
      description: loginDesc,
      barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
      dayLabel: currentDayLabel
    });

    // AP 패키지 수령
    if (useApPackage) {
      const toBar = Math.min(150, Math.max(0, 999 - barAp));
      const toMail = 150 - toBar;
      barAp += toBar;
      addToMailbox('2주 AP 패키지', toMail, loginTime);
      timeline.push({
        time: addMinutes(loginTime, timeOffset++),
        action: '2주 AP 패키지 자동 수령',
        description: `접속과 동시에 자동 수령 (150 AP)`,
        barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
        dayLabel: currentDayLabel
      });
    }

    // AP 충전/구매 (청휘석, 대항전 코인)
    if (pvpRefreshes > 0 || targetPyroxeneRefreshes > 0) {
      let remainingPvp = pvpRefreshes;
      let remainingPyro = targetPyroxeneRefreshes;
      let pvpSpent = 0;
      let pyroSpent = 0;
      let addedPvpToMailbox = 0;
      let addedPyroToMailbox = 0;

      while (remainingPyro > 0 && barAp < 999) {
        const toBar = Math.min(120, 999 - barAp);
        barAp += toBar;
        if (120 - toBar > 0) addedPyroToMailbox += (120 - toBar);
        remainingPyro--;
        pyroSpent++;
      }

      while (remainingPvp > 0 && barAp < 999) {
        const toBar = Math.min(90, 999 - barAp);
        barAp += toBar;
        if (90 - toBar > 0) addedPvpToMailbox += (90 - toBar);
        remainingPvp--;
        pvpSpent++;
      }

      if (addedPyroToMailbox > 0) addToMailbox('청휘석 AP 충전', addedPyroToMailbox, addMinutes(loginTime, timeOffset));
      if (addedPvpToMailbox > 0) addToMailbox('대항전 코인', addedPvpToMailbox, addMinutes(loginTime, timeOffset));

      let desc = '';
      if (pyroSpent > 0) desc += `AP 충전 ${pyroSpent}회(${pyroSpent * 120} AP) 획득.\n`;
      if (pvpSpent > 0) desc += `대항전 코인 ${pvpSpent}회(${pvpSpent * 90} AP) 구매.\n`;
      if (remainingPvp > 0 || remainingPyro > 0) desc += `(999 AP 상한에 막혀 남은 횟수는 다음에)`;

      timeline.push({
        time: addMinutes(loginTime, timeOffset++),
        action: 'AP 충전 및 구매',
        description: desc.trim(),
        isImportant: true,
        barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
        dayLabel: currentDayLabel
      });
    }

    // 999AP 상한 경고
    if (barAp >= 999) {
      timeline.push({
        time: addMinutes(loginTime, timeOffset++),
        action: '⚠ 999AP 상한 도달',
        description: '999AP를 보유한 상태에서는 총력전, 전술대항전, 카페 자원 수거 등이 제한됩니다.\n다음 단계로 넘어가기 전 할 일을 모두 끝마쳤는지 다시 한 번 확인해 보세요.',
        isWarning: true,
        barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
        dayLabel: currentDayLabel
      });
    }

    // 카페 AP 수거
    if (cafeAp > 0) {
      const cafeTime = addMinutes(loginTime, timeOffset++);
      const toBar = Math.min(cafeAp, Math.max(0, 999 - barAp));
      barAp += toBar;
      const toMail = cafeAp - toBar;
      addToMailbox('카페 AP', toMail, cafeTime);
      timeline.push({
        time: cafeTime,
        action: `카페 AP ${cafeAp} 수거 (23:59까지)`,
        description: toMail > 0 ? `바 ${toBar} / 우편함 ${toMail}` : `바에 ${toBar} AP 추가`,
        barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
        dayLabel: currentDayLabel
      });
    }

    // 일일 미션
    if (useDailyQuest) {
      const questTime = addMinutes(loginTime, timeOffset++);
      const toBar = Math.min(150, Math.max(0, 999 - barAp));
      barAp += toBar;
      const toMail = 150 - toBar;
      addToMailbox('일일 미션', toMail, questTime);
      timeline.push({
        time: questTime,
        action: '일일 미션 AP 수령',
        description: `일일 미션 보상 150 AP 수령`,
        barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
        dayLabel: currentDayLabel
      });
    }

    // 대항전 코인 구매 (바가 999 미만이면 추가 구매 가능)
    if (pvpRefreshes > 0 && barAp < 999) {
      let addedPvp = 0;
      let pvpCount = 0;
      let remaining = pvpRefreshes;
      while (remaining > 0 && barAp < 999) {
        const toBar = Math.min(90, 999 - barAp);
        barAp += toBar;
        addedPvp += toBar;
        remaining--;
        pvpCount++;
      }
      if (pvpCount > 0) {
        timeline.push({
          time: addMinutes(loginTime, timeOffset++),
          action: `대항전 코인 ${pvpCount}회 추가 구매`,
          description: `대항전 코인 ${pvpCount}회 구매 (${addedPvp} AP)`,
          barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
          dayLabel: currentDayLabel
        });
      }
    }

    // 우편함 AP 보관 안내
    if (totalMailbox() > 0) {
      timeline.push({
        time: addMinutes(loginTime, timeOffset++),
        action: '우편함 AP 보관 안내',
        description: '오늘 우편함에 들어간 AP는 일부 또는 전부 오늘 사용해도 무방합니다.\n단, 우편함에 들어가지 않은 보유 중인 AP는 유지해 주세요.',
        isWarning: true,
        barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
        dayLabel: currentDayLabel
      });
    }

    // D-1일에 TR-4 1AP 소모 (23:59분)
    if (dayOffset === 1 && useTr4DailyQuest) {
      const tr4Time = new Date(currentDate);
      tr4Time.setHours(23, 59, 0, 0);

      barAp = Math.max(0, barAp - 1);
      timeline.push({
        time: tr4Time,
        action: '2지역 TR-4에서 AP 1 소모',
        description: '23:59분에 TR-4 2지역에서 AP 1 소모하여 일퀘 달성.\n이렇게 하면 내일(D-Day) 일일 미션 보상을 추가 획득 가능.',
        isImportant: true,
        barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
        dayLabel: currentDayLabel
      });
    }

    // 출석부 (중간일 중 해당 일차에만)
    if (todayAttendance > 0) {
      // 존버 기간 중 출석부 해당일이면
      const attendDay = todayAttendance + (hoardingDays - dayOffset);
      if (attendDay <= 10) {
        const attendTime = addMinutes(loginTime, timeOffset++);
        const toBar = Math.min(150, Math.max(0, 999 - barAp));
        barAp += toBar;
        const toMail = 150 - toBar;
        addToMailbox(`출석부 ${attendDay}일차`, toMail, attendTime);
        timeline.push({
          time: attendTime,
          action: `출석부 ${attendDay}일차 AP 수령`,
          description: `출석 보상 150 AP 수령`,
          barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
          dayLabel: currentDayLabel
        });
      }
    }

    // 중간일 끝: 다음 날을 위한 barAp 유지 (999에 가까운 상태)
    // 실제로 barAp는 유지됨 (소모하지 않으면 다음 날에도 동일)
    // 단, 자연 회복은 maxAp까지만
  }

  // ── D-Day ──
  const dDayLabel = getDayLabel(dDayDate);
  let dDayTime = subMinutes(dDayDate, 30);
  const lastMiddleDay = subDays(dDayDate, 1);
  const lastMiddleDayLogin = new Date(lastMiddleDay);
  lastMiddleDayLogin.setHours(23, 50, 0, 0);
  if (dDayTime <= lastMiddleDayLogin) dDayTime = addMinutes(lastMiddleDayLogin, 10);

  timeline.push({
    time: dDayTime,
    action: 'D-Day 이벤트 당일 (우편함 작업)',
    description: `1. 보유 중인 ${barAp} AP를 먼저 소모하세요.\n2. 우편함에 누적된 존버 AP(${totalMailbox()} AP)를 꺼내서 소모하세요.\n3. 아래 나오는 당일 자원들을 '수령 → 소모' 순서로 반복 처리하세요.`,
    isImportant: true,
    barAp, mailboxAp: totalMailbox(), mailboxDetails: cloneMailboxDetails(),
    dayLabel: dDayLabel
  });

  let dDayTotal = barAp + totalMailbox();
  let dDayTimeOffset = 1;

  // 당일 AP 패키지
  if (useApPackage) {
    dDayTotal += 150;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 2주 패키지 수령',
      description: `2주 AP 패키지 당일분 150 AP 수령`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  // 당일 카페
  if (cafeAp > 0) {
    dDayTotal += cafeAp;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 카페 수거',
      description: `카페 AP ${cafeAp} 수거`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  // 당일 일퀘
  if (useDailyQuest) {
    dDayTotal += 150;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 일일 미션 수령',
      description: `일일 미션 보상 150 AP 수령`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  // 당일 주간 미션
  let canUseWeeklyQuest = useWeeklyQuest;
  if (useWeeklyQuest) {
    const day = targetDate.getDay();
    const hours = targetDate.getHours();
    if (day >= 2 && day <= 4) {
      canUseWeeklyQuest = false;
    } else if (day === 1 && hours >= 4) {
      canUseWeeklyQuest = false;
    }
  }

  if (canUseWeeklyQuest) {
    dDayTotal += 200;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 주간 미션 수령',
      description: `주간 미션 보상 200 AP 수령`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  } else if (useWeeklyQuest) {
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '주간 미션 수령 불가',
      description: `목표 요일 특성상 주간 미션(5일 접속)을 달성/수령할 수 없습니다.\n(수령 가능 시간: 금요일 ~ 월요일 03:59)`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  // 당일 대항전 코인
  if (pvpRefreshes > 0) {
    const dDayPvp = pvpRefreshes * 90;
    dDayTotal += dDayPvp;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 대항전 코인 구매',
      description: `대항전 코인 ${pvpRefreshes}회 구매 (${dDayPvp} AP)`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  // 우편함 만료 경고
  const expiryWarnings = allMailboxExpiry.filter(e => e.expiresAt <= targetDate);

  // 최종 소모
  timeline.push({
    time: targetDate,
    action: '모든 AP 소모 완료',
    description: `최종 획득 가능 AP: ${dDayTotal} AP`,
    isImportant: true,
    barAp: 0, mailboxAp: 0,
    dayLabel: dDayLabel,
    mailboxExpiryDetails: allMailboxExpiry.length > 0 ? [...allMailboxExpiry] : undefined
  });

  // 가장 빠른 만료 시간
  const earliestExpiry = allMailboxExpiry.length > 0
    ? allMailboxExpiry.reduce((min, e) => e.expiresAt < min ? e.expiresAt : min, allMailboxExpiry[0].expiresAt)
    : undefined;

  return {
    isPossible: true,
    totalHoardedAp: dDayTotal,
    timeline,
    earliestMailboxExpiry: earliestExpiry,
    mailboxExpiryWarnings: expiryWarnings.length > 0 ? expiryWarnings : undefined,
    isRetroactive,
    warningMessage
  };
}

/**
 * 1일 존버 전용 로직 (기존 로직 유지 + dayLabel/만료 시간 추가)
 */
function calculate1Day(
  targetDate: Date,
  currentAp: number,
  cafeAp: number,
  useDailyQuest: boolean,
  pvpRefreshes: number,
  targetPyroxeneRefreshes: number,
  useApPackage: boolean,
  userLevel: number,
  maxAp: number,
  bufferHours: number,
  todayAttendance: number,
  useWeeklyQuest: boolean,
  now: Date,
  allMailboxExpiry: MailboxExpiryItem[]
): ApCalculationResult {
  const mailboxTime = subHours(targetDate, bufferHours);
  if (mailboxTime <= now) {
    return {
      isPossible: false,
      totalHoardedAp: 0,
      timeline: [],
      errorMessage: `목표 시간까지 남은 시간이 너무 짧습니다. (최소 ${bufferHours}시간 이상 필요)`
    };
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
  const mailboxDetails: { name: string; amount: number }[] = [];
  let mailboxAp = 0;
  let hoardedAp = 0;

  const addToMailbox = (name: string, amount: number, time: Date) => {
    if (amount <= 0) return;
    const existing = mailboxDetails.find(i => i.name === name);
    if (existing) {
      existing.amount += amount;
    } else {
      mailboxDetails.push({ name, amount });
    }
    allMailboxExpiry.push({ name, amount, expiresAt: addHours(time, 24) });
  };

  const cloneMailboxDetails = () => mailboxDetails.map(i => ({ ...i }));

  const hoardStartLabel = getDayLabel(startHoardTime > now ? startHoardTime : now);
  const mailboxDayLabel = getDayLabel(mailboxTime);
  const dDayLabel = getDayLabel(targetDate);

  if (startHoardTime > now) {
    timeline.push({
      time: startHoardTime,
      action: '존버 시작 (AP 소모 중단)',
      description: `이 시점까지 AP를 자유롭게 쓰다가 0 근처로 비우세요.\n이후 자연 회복으로 목표치(${targetNaturalAp} AP)를 모읍니다.`,
      barAp: 0,
      mailboxAp: 0,
      dayLabel: hoardStartLabel
    });
  } else {
    const naturalRegen = Math.floor(differenceInMinutes(mailboxTime, now) / 6);
    timeline.push({
      time: now,
      action: '즉시 존버 시작',
      description: `지금부터 우편함 작업 시간까지 자연 회복을 최대한 모읍니다.\n(현재 ${currentAp} AP, 추가 회복 예상량 ${naturalRegen} AP)`,
      barAp: currentAp,
      mailboxAp: 0,
      dayLabel: hoardStartLabel
    });
  }

  let barAp = startHoardTime > now ? targetNaturalAp : Math.min(maxAp, currentAp + Math.floor(differenceInMinutes(mailboxTime, now) / 6));

  timeline.push({
    time: mailboxTime,
    action: 'D-1 우편함 작업 시작 (로그인)',
    description: `접속 시 자연 회복된 분량인 ${barAp} AP 보유`,
    barAp, mailboxAp, mailboxDetails: cloneMailboxDetails(),
    dayLabel: mailboxDayLabel
  });

  let timeOffset = 1;

  if (useApPackage) {
    const toBar = Math.min(150, Math.max(0, 999 - barAp));
    const toMailbox = 150 - toBar;
    barAp += toBar;
    hoardedAp += toMailbox;
    addToMailbox('2주 AP 패키지', toMailbox, addMinutes(mailboxTime, timeOffset));
    timeline.push({
      time: addMinutes(mailboxTime, timeOffset++),
      action: '2주 AP 패키지 자동 수령',
      description: '접속과 동시에 자동으로 수령됩니다.',
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: cloneMailboxDetails(),
      dayLabel: mailboxDayLabel
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

    if (addedPvpToMailbox > 0) addToMailbox('전술대회 상점 코인', addedPvpToMailbox, addMinutes(mailboxTime, timeOffset));
    if (addedPyroToMailbox > 0) addToMailbox('청휘석 AP 충전', addedPyroToMailbox, addMinutes(mailboxTime, timeOffset));

    let desc = '';
    if (pvpSpent > 0) desc += `대항전 코인 ${pvpSpent}회(${pvpSpent * 90} AP) 구매.\n`;
    if (pyroSpent > 0) desc += `AP 충전 ${pyroSpent}회(${pyroSpent * 120} AP) 획득.\n`;
    if (remainingPvp > 0 || remainingPyro > 0) desc += `(999 AP 상한에 막혀 남은 횟수는 구매 실패)\n`;

    timeline.push({
      time: addMinutes(mailboxTime, timeOffset++),
      action: 'AP 충전 및 구매',
      description: desc.trim(),
      isImportant: true,
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: cloneMailboxDetails(),
      dayLabel: mailboxDayLabel
    });
  }

  if (cafeAp > 0) {
    const cafeTime = addMinutes(mailboxTime, timeOffset++);
    const toBar = Math.min(cafeAp, Math.max(0, 999 - barAp));
    barAp += toBar;
    mailboxAp += (cafeAp - toBar);
    addToMailbox('카페 AP', cafeAp - toBar, cafeTime);
    timeline.push({
      time: cafeTime,
      action: '카페 AP 수거',
      description: `카페 AP ${cafeAp} 수거 (우편함 보관)`,
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: cloneMailboxDetails(),
      dayLabel: mailboxDayLabel
    });
  }

  if (useDailyQuest) {
    const questTime = addMinutes(mailboxTime, timeOffset++);
    const toBar = Math.min(150, Math.max(0, 999 - barAp));
    barAp += toBar;
    mailboxAp += (150 - toBar);
    addToMailbox('일일 미션', 150 - toBar, questTime);
    timeline.push({
      time: questTime,
      action: '일일 미션 AP 수령',
      description: `일일 미션 보상 150 AP 수령 (우편함 보관)`,
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: cloneMailboxDetails(),
      dayLabel: mailboxDayLabel
    });
  }

  if (todayAttendance > 0) {
    const attendTime = addMinutes(mailboxTime, timeOffset++);
    const toBar = Math.min(150, Math.max(0, 999 - barAp));
    barAp += toBar;
    hoardedAp += (150 - toBar);
    addToMailbox(`출석부 ${todayAttendance}일차`, 150 - toBar, attendTime);
    timeline.push({
      time: attendTime,
      action: `출석부 ${todayAttendance}일차 AP 수령`,
      description: `출석 보상 150 AP 수령 (우편함 보관)`,
      barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: cloneMailboxDetails(),
      dayLabel: mailboxDayLabel
    });
  }

  let dDayTime = subMinutes(targetDate, 30);
  if (dDayTime <= mailboxTime) dDayTime = addMinutes(mailboxTime, 10);

  timeline.push({
    time: dDayTime,
    action: 'D-Day 이벤트 당일 (우편함 작업)',
    description: `1. 보유 중인 999 AP를 먼저 소모하세요.\n2. 우편함에 누적된 존버 AP를 꺼내서 소모하세요.\n3. 아래 나오는 당일 자원들을 '수령 → 소모' 순서로 반복 처리하세요.`,
    isImportant: true,
    barAp, mailboxAp: mailboxAp + hoardedAp, mailboxDetails: cloneMailboxDetails(),
    dayLabel: dDayLabel
  });

  let dDayTotal = barAp + mailboxAp + hoardedAp;
  let dDayTimeOffset = 1;

  if (useApPackage) {
    dDayTotal += 150;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 2주 패키지 수령',
      description: `2주 AP 패키지 당일분 150 AP 수령`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  if (cafeAp > 0) {
    dDayTotal += cafeAp;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 카페 수거',
      description: `카페 AP ${cafeAp} 수거`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  if (useDailyQuest) {
    dDayTotal += 150;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 일일 미션 수령',
      description: `일일 미션 보상 150 AP 수령`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  let canUseWeeklyQuest = useWeeklyQuest;
  if (useWeeklyQuest) {
    const day = targetDate.getDay();
    const hours = targetDate.getHours();
    if (day >= 2 && day <= 4) {
      canUseWeeklyQuest = false;
    } else if (day === 1 && hours >= 4) {
      canUseWeeklyQuest = false;
    }
  }

  if (canUseWeeklyQuest) {
    dDayTotal += 200;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 주간 미션 수령',
      description: `주간 미션 보상 200 AP 수령`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  } else if (useWeeklyQuest) {
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '주간 미션 수령 불가',
      description: `목표 요일 특성상 주간 미션(5일 접속)을 달성/수령할 수 없습니다.\n(수령 가능 시간: 금요일 ~ 월요일 03:59)`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  if (pvpRefreshes > 0) {
    const dDayPvp = pvpRefreshes * 90;
    dDayTotal += dDayPvp;
    timeline.push({
      time: addMinutes(dDayTime, dDayTimeOffset++),
      action: '당일 대항전 코인 구매',
      description: `대항전 코인 ${pvpRefreshes}회 구매 (${dDayPvp} AP)`,
      barAp: 999, mailboxAp: dDayTotal - 999,
      dayLabel: dDayLabel
    });
  }

  // 만료 경고
  const expiryWarnings = allMailboxExpiry.filter(e => e.expiresAt <= targetDate);

  timeline.push({
    time: targetDate,
    action: '모든 AP 소모 완료',
    description: `최종 획득 가능 AP: ${dDayTotal} AP`,
    isImportant: true,
    barAp: 0, mailboxAp: 0,
    dayLabel: dDayLabel,
    mailboxExpiryDetails: allMailboxExpiry.length > 0 ? [...allMailboxExpiry] : undefined
  });

  const earliestExpiry = allMailboxExpiry.length > 0
    ? allMailboxExpiry.reduce((min, e) => e.expiresAt < min ? e.expiresAt : min, allMailboxExpiry[0].expiresAt)
    : undefined;

  return {
    isPossible: true,
    totalHoardedAp: dDayTotal,
    timeline,
    earliestMailboxExpiry: earliestExpiry,
    mailboxExpiryWarnings: expiryWarnings.length > 0 ? expiryWarnings : undefined
  };
}
