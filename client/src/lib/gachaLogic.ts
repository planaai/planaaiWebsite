/**
 * @file gachaLogic.ts
 * @description 블루아카이브 신규 가챠 로직 (모집 차지 및 모집 횟수 특전) 구현
 */

export type ChargeType = 'regular' | 'limited';

export type GuaranteeType = 'charge_100' | 'charge_200' | 'slot_10';

export interface GachaResult {
  name: string;
  rarity: 1 | 2 | 3;
  isPickup: boolean;
  isNew?: boolean;
  guaranteeType?: GuaranteeType;
}

export interface GachaPickup {
  name: string;
  rarity?: number;
  star?: number;
  rate?: number;
  probability?: number;
}

export interface GachaBanner {
  id?: string | number;
  name?: string;
  url?: string;
  pickups: GachaPickup[];
}

export interface GachaPoolItem {
  name: string;
  probability?: number;
}

export interface RateTable {
  "3_star": number;
  "2_star": number;
  "1_star": number;
}

export interface GachaData {
  banners: GachaBanner[];
  rates?: {
    normal?: RateTable;
    guaranteed?: RateTable;
  };
  pools: {
    "3_star": (string | GachaPoolItem)[];
    "2_star": (string | GachaPoolItem)[];
    "1_star": (string | GachaPoolItem)[];
  };
}

export interface MilestoneReward {
  count: number;
  reward: string;
  isRepeatable?: boolean;
}

export interface ExecutePullParams {
  gachaData: GachaData;
  bannerIndex?: number;
  pullCount: 1 | 10;
  currentChargeStack: number;
  currentRecruitCount: number;
  encoreTarget?: string;
}

export interface PullExecutionResult {
  results: GachaResult[];
  nextChargeStack: number;
  nextRecruitCount: number;
  newlyUnlockedMilestones: MilestoneReward[];
}

/** 초회 모집 횟수 특전 보상 테이블 (10 ~ 390) */
export const INITIAL_MILESTONE_REWARDS: readonly MilestoneReward[] = [
  { count: 10, reward: '상급 전술 교육 BD 선택 상자 x2' },
  { count: 30, reward: '엘리그마 x10' },
  { count: 50, reward: '상급 기술 노트 선택 상자 x5' },
  { count: 70, reward: '기간 한정 10회 모집 티켓 x1' },
  { count: 90, reward: '선물 상자 x2' },
  { count: 110, reward: '엘리그마 x20' },
  { count: 130, reward: '기간 한정 10회 모집 티켓 x1' },
  { count: 150, reward: '기간 한정 10회 모집 티켓 x1' },
  { count: 170, reward: '기간 한정 10회 모집 티켓 x1' },
  { count: 190, reward: '최상급 기술 노트 선택 상자 x5' },
  { count: 210, reward: '상급 전술 교육 BD 선택 상자 x2' },
  { count: 230, reward: '엘리그마 x10' },
  { count: 250, reward: '상급 기술 노트 선택 상자 x5' },
  { count: 270, reward: '기간 한정 10회 모집 티켓 x1' },
  { count: 290, reward: '선물 상자 x2' },
  { count: 310, reward: '엘리그마 x20' },
  { count: 330, reward: '기간 한정 10회 모집 티켓 x1' },
  { count: 350, reward: '기간 한정 10회 모집 티켓 x1' },
  { count: 370, reward: '기간 한정 10회 모집 티켓 x1' },
  { count: 390, reward: '최상급 기술 노트 선택 상자 x5' },
] as const;

/** 반복 모집 횟수 특전 보상 주기 (390회 이후 매 20회 간격, 200회 사이클) */
export const REPEAT_MILESTONE_CYCLE: readonly { offset: number; reward: string }[] = [
  { offset: 20, reward: '상급 전술 교육 BD 선택 상자 x1' }, // 410
  { offset: 40, reward: '상급 기술 노트 선택 상자 x3' },     // 430
  { offset: 60, reward: '선물 상자 x1' },                   // 450
  { offset: 80, reward: '기동석 조각 x30' },                // 470
  { offset: 100, reward: '엘리그마 x10' },                  // 490
  { offset: 120, reward: '비전 노트 x1' },                  // 510
  { offset: 140, reward: '최상급 전술 교육 BD 선택 상자 x1' },// 530
  { offset: 160, reward: '고급 선물 상자 x1' },              // 550
  { offset: 180, reward: '최상급 기술 노트 선택 상자 x3' },   // 570
  { offset: 200, reward: '엘리그마 x10' },                  // 590
] as const;

const DEFAULT_NORMAL_RATES: RateTable = {
  "3_star": 0.03,
  "2_star": 0.185,
  "1_star": 0.785,
};

const DEFAULT_GUARANTEED_RATES: RateTable = {
  "3_star": 0.03,
  "2_star": 0.97,
  "1_star": 0,
};

/**
 * 배너 이름을 기반으로 차지 유형 판별
 * 한정/페스/주년/리콜렉트/앙코르 -> limited (분홍색)
 * 그 외 일반 픽업 -> regular (하늘색)
 */
export function getBannerChargeType(bannerName?: string): ChargeType {
  if (!bannerName) return 'regular';
  const limitedKeywords = ['한정', '페스', '주년', '리콜렉트', '앙코르', 'Fes'];
  return limitedKeywords.some(keyword => bannerName.includes(keyword)) ? 'limited' : 'regular';
}

/**
 * 특정 횟수에서의 모집 횟수 특전 보상 반환
 */
export function getMilestoneRewardAtCount(count: number): MilestoneReward | null {
  if (count <= 0) return null;

  if (count <= 390) {
    const found = INITIAL_MILESTONE_REWARDS.find(r => r.count === count);
    return found ? { ...found, isRepeatable: false } : null;
  }

  const offset = count - 390;
  const cycleOffset = offset % 200 === 0 ? 200 : offset % 200;
  const match = REPEAT_MILESTONE_CYCLE.find(item => item.offset === cycleOffset);
  if (match) {
    return {
      count,
      reward: match.reward,
      isRepeatable: true,
    };
  }

  return null;
}

/**
 * 특정 횟수 구간(previousCount ~ currentCount) 동안 달성된 보상 목록 반환
 */
export function getMilestonesInRange(previousCount: number, currentCount: number): MilestoneReward[] {
  const milestones: MilestoneReward[] = [];
  for (let c = previousCount + 1; c <= currentCount; c++) {
    const reward = getMilestoneRewardAtCount(c);
    if (reward) {
      milestones.push(reward);
    }
  }
  return milestones;
}

/**
 * 다음으로 달성 가능한 특전 보상 반환
 */
export function getNextMilestoneReward(currentCount: number): MilestoneReward | null {
  if (currentCount < 390) {
    const next = INITIAL_MILESTONE_REWARDS.find(r => r.count > currentCount);
    if (next) return next;
  }

  const remainder = (currentCount - 390) % 20;
  const nextCount = currentCount + (20 - (remainder === 0 ? 20 : remainder));
  return getMilestoneRewardAtCount(nextCount);
}

function extractItemName(item: string | GachaPoolItem | undefined): string {
  if (!item) return '';
  return typeof item === 'string' ? item : (item.name || '');
}

function getRandomFromPool(pool: (string | GachaPoolItem)[]): string {
  if (!pool || pool.length === 0) return '';
  const selected = pool[Math.floor(Math.random() * pool.length)];
  return extractItemName(selected);
}

function getEffectivePickups(banner: GachaBanner, encoreTarget?: string): GachaPickup[] {
  if (typeof banner?.name === 'string' && banner.name.includes('앙코르 모집') && encoreTarget) {
    return [{ name: encoreTarget, rarity: 3, rate: 0.007 }];
  }
  return banner.pickups || [];
}

/**
 * 1회 모집 시 단일 학생 추첨 및 차지 스택 계산
 */
function rollSinglePullWithCharge(
  gachaData: GachaData,
  banner: GachaBanner,
  currentStack: number,
  isSlot10Guaranteed: boolean,
  encoreTarget?: string
): { result: GachaResult; nextStack: number } {
  const nextTentativeStack = currentStack + 1;
  const effectivePickups = getEffectivePickups(banner, encoreTarget);
  const pickupStudentName = effectivePickups[0]?.name || '';

  // 1. 200 스택 달성: 픽업 대상 학생 확정 획득 -> 픽업 획득으로 스택 즉시 0 리셋
  if (nextTentativeStack === 200) {
    return {
      result: {
        name: pickupStudentName || getRandomFromPool(gachaData.pools['3_star']),
        rarity: 3,
        isPickup: true,
        guaranteeType: 'charge_200',
      },
      nextStack: 0,
    };
  }

  // 2. 100 스택 달성: 3성 1명 확정 등장 (픽업 50%, 일반 3성 50%)
  if (nextTentativeStack === 100) {
    const isPickupHit = Math.random() < 0.5 && Boolean(pickupStudentName);
    if (isPickupHit) {
      // 픽업 대상을 뽑았으므로 스택 0 리셋
      return {
        result: {
          name: pickupStudentName,
          rarity: 3,
          isPickup: true,
          guaranteeType: 'charge_100',
        },
        nextStack: 0,
      };
    }

    // 픽업이 아닌 일반 3성 획득 -> 스택은 100 유지
    const nonPickupPool = gachaData.pools['3_star'].filter(
      item => extractItemName(item) !== pickupStudentName
    );
    const selectedName = nonPickupPool.length > 0 
      ? getRandomFromPool(nonPickupPool) 
      : getRandomFromPool(gachaData.pools['3_star']);

    return {
      result: {
        name: selectedName,
        rarity: 3,
        isPickup: false,
        guaranteeType: 'charge_100',
      },
      nextStack: 100,
    };
  }

  // 3. 통상 확률 추첨
  const rates = isSlot10Guaranteed
    ? (gachaData.rates?.guaranteed || DEFAULT_GUARANTEED_RATES)
    : (gachaData.rates?.normal || DEFAULT_NORMAL_RATES);

  const roll = Math.random();
  let selectedRarity: 1 | 2 | 3 = 1;

  if (roll < rates['3_star']) {
    selectedRarity = 3;
  } else if (roll < rates['3_star'] + rates['2_star']) {
    selectedRarity = 2;
  } else {
    selectedRarity = 1;
  }

  if (selectedRarity === 3) {
    const pickupRoll = Math.random();
    const totalPickupRate = effectivePickups.reduce(
      (sum: number, p: GachaPickup) =>
        sum + (p.rate !== undefined ? p.rate : (p.probability !== undefined ? p.probability / 100 : 0)),
      0
    );
    const normalizedPickupChance = rates['3_star'] > 0 ? totalPickupRate / rates['3_star'] : 0;

    if (pickupRoll < normalizedPickupChance && pickupStudentName) {
      // 통상 추첨에서 픽업 대상을 뽑은 경우 -> 스택 0으로 초기화
      return {
        result: {
          name: pickupStudentName,
          rarity: 3,
          isPickup: true,
          guaranteeType: isSlot10Guaranteed ? 'slot_10' : undefined,
        },
        nextStack: 0,
      };
    }

    // 통상 3성 획득 -> 스택 유지 및 증가
    const pool = gachaData.pools['3_star'];
    return {
      result: {
        name: getRandomFromPool(pool),
        rarity: 3,
        isPickup: false,
        guaranteeType: isSlot10Guaranteed ? 'slot_10' : undefined,
      },
      nextStack: nextTentativeStack,
    };
  }

  if (selectedRarity === 2) {
    return {
      result: {
        name: getRandomFromPool(gachaData.pools['2_star']),
        rarity: 2,
        isPickup: false,
        guaranteeType: isSlot10Guaranteed ? 'slot_10' : undefined,
      },
      nextStack: nextTentativeStack,
    };
  }

  // selectedRarity === 1
  return {
    result: {
      name: getRandomFromPool(gachaData.pools['1_star']),
      rarity: 1,
      isPickup: false,
    },
    nextStack: nextTentativeStack,
  };
}

/**
 * 1회 또는 10회 가챠 실행 메인 함수
 */
export function executeGachaPull(params: ExecutePullParams): PullExecutionResult {
  const {
    gachaData,
    bannerIndex = 0,
    pullCount,
    currentChargeStack,
    currentRecruitCount,
    encoreTarget,
  } = params;

  const banner = gachaData.banners[bannerIndex] || gachaData.banners[0] || { pickups: [] };
  const results: GachaResult[] = [];
  let runningStack = currentChargeStack;

  for (let i = 0; i < pullCount; i++) {
    const isSlot10Guaranteed = pullCount === 10 && i === 9;
    const { result, nextStack } = rollSinglePullWithCharge(
      gachaData,
      banner,
      runningStack,
      isSlot10Guaranteed,
      encoreTarget
    );

    runningStack = nextStack;
    results.push(result);
  }

  const nextRecruitCount = currentRecruitCount + pullCount;
  const newlyUnlockedMilestones = getMilestonesInRange(currentRecruitCount, nextRecruitCount);

  return {
    results,
    nextChargeStack: runningStack,
    nextRecruitCount,
    newlyUnlockedMilestones,
  };
}

/**
 * 하위 호환성을 위한 래퍼 함수들
 */
export function performSinglePull(
  gachaData: GachaData,
  bannerIndex: number = 0,
  encoreTarget?: string
): GachaResult[] {
  const { results } = executeGachaPull({
    gachaData,
    bannerIndex,
    pullCount: 1,
    currentChargeStack: 0,
    currentRecruitCount: 0,
    encoreTarget,
  });
  return results;
}

export function performTenPull(
  gachaData: GachaData,
  bannerIndex: number = 0,
  encoreTarget?: string
): GachaResult[] {
  const { results } = executeGachaPull({
    gachaData,
    bannerIndex,
    pullCount: 10,
    currentChargeStack: 0,
    currentRecruitCount: 0,
    encoreTarget,
  });
  return results;
}
