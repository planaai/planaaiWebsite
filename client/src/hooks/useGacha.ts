import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  executeGachaPull,
  getBannerChargeType,
  ChargeType,
  GachaData,
  GachaResult,
} from '@/lib/gachaLogic';
import { fetchGachaStatus } from '@/lib/api';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import { toast } from 'sonner';

const STORAGE_KEYS = {
  CHARGE_STACKS: 'plana_gacha_charge_stacks',
} as const;

interface ChargeStacksState {
  regular: number;
  limited: number;
}

const DEFAULT_STACKS: ChargeStacksState = {
  regular: 0,
  limited: 0,
};

export function useGacha() {
  const [gachaData, setGachaData] = useState<GachaData | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [results, setResults] = useState<GachaResult[]>([]);
  const [pullHistory, setPullHistory] = useState<GachaResult[]>([]);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [masterDataMap, setMasterDataMap] = useState<Record<string, StudentMaster>>({});
  const [encoreTarget, setEncoreTarget] = useState<string>('');

  // 모집 차지 스택 (일반 / 한정 분리 저장)
  const [chargeStacks, setChargeStacks] = useState<ChargeStacksState>(() => {
    if (typeof window === 'undefined') return DEFAULT_STACKS;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHARGE_STACKS);
      return saved ? JSON.parse(saved) : DEFAULT_STACKS;
    } catch {
      return DEFAULT_STACKS;
    }
  });

  // LocalStorage 동기화
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHARGE_STACKS, JSON.stringify(chargeStacks));
    } catch {
      // Ignore storage errors
    }
  }, [chargeStacks]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [{ masterData }, gachaStatus] = await Promise.all([
          getCachedServerData(),
          fetchGachaStatus().catch(() => null),
        ]);

        if (cancelled) return;

        const map: Record<string, StudentMaster> = {};
        masterData.forEach((student) => {
          const normalizedName = student.name.replace(/\s+/g, '');
          map[normalizedName] = student;
        });
        setMasterDataMap(map);

        if (gachaStatus) {
          if (gachaStatus.pools && gachaStatus.pools['3_star']) {
            gachaStatus.pools['3_star'] = gachaStatus.pools['3_star'].filter((item: unknown) => {
              const nameStr = typeof item === 'string' ? item : (item as { name?: string })?.name || '';
              return typeof nameStr === 'string' && !nameStr.includes('앙코르 모집');
            });
          }
          setGachaData(gachaStatus);
        }
      } catch {
        if (!cancelled) toast.error('데이터를 불러오는데 실패했습니다.');
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const banner = gachaData?.banners?.[activeBannerIndex] || gachaData?.banners?.[0];
  const isEncore = Boolean(banner?.name?.includes('앙코르 모집'));

  // 현재 활성화된 배너의 차지 유형 ('regular' | 'limited')
  const chargeType: ChargeType = useMemo(
    () => getBannerChargeType(banner?.name),
    [banner?.name]
  );

  // 현재 배너에 적용되는 차지 스택 값
  const currentChargeStack = chargeStacks[chargeType];

  const handlePull = useCallback(
    (type: 'single' | 'ten') => {
      if (!gachaData || !banner) return;
      if (isEncore && !encoreTarget) {
        toast.error('잠시 후에 다시 시도해 주세요');
        return;
      }

      const pullCount: 1 | 10 = type === 'single' ? 1 : 10;
      const executionResult = executeGachaPull({
        gachaData,
        bannerIndex: activeBannerIndex,
        pullCount,
        currentChargeStack,
        currentRecruitCount: 0,
        encoreTarget,
      });

      // 스택 업데이트
      setChargeStacks((prev) => ({
        ...prev,
        [chargeType]: executionResult.nextChargeStack,
      }));

      // 신규 획득 여부 계산 및 결과 반영
      setPullHistory((prev) => {
        const historyNames = new Set(prev.map((p) => p.name));
        const finalResults = executionResult.results.map((r) => ({
          ...r,
          isNew: !historyNames.has(r.name),
        }));
        setResults(finalResults);
        return [...prev, ...finalResults];
      });

      setShowResultScreen(true);
    },
    [gachaData, banner, isEncore, encoreTarget, activeBannerIndex, currentChargeStack, chargeType]
  );

  // 뽑기 결과 화면 및 기록 리셋
  const handleResetHistory = useCallback(() => {
    setResults([]);
    setPullHistory([]);
    setShowResultScreen(false);
    toast.info('모의 가챠 뽑기 기록이 초기화되었습니다.');
  }, []);

  // 차지 스택 전체 초기화
  const handleResetStacks = useCallback(() => {
    setChargeStacks(DEFAULT_STACKS);
    setResults([]);
    setPullHistory([]);
    setShowResultScreen(false);
    toast.info('모집 차지 스택이 초기화되었습니다.');
  }, []);

  const inventorySummary = useMemo(() => {
    const summary: Record<string, { count: number; rarity: number; isPickup: boolean }> = {};
    pullHistory.forEach((r) => {
      if (!summary[r.name]) {
        summary[r.name] = { count: 0, rarity: r.rarity, isPickup: r.isPickup };
      }
      summary[r.name].count += 1;
    });

    return Object.entries(summary).sort((a, b) => {
      if (a[1].isPickup && !b[1].isPickup) return -1;
      if (!a[1].isPickup && b[1].isPickup) return 1;
      if (b[1].rarity !== a[1].rarity) return b[1].rarity - a[1].rarity;
      return b[1].count - a[1].count;
    });
  }, [pullHistory]);

  return {
    gachaData,
    activeBannerIndex,
    setActiveBannerIndex,
    results,
    setResults,
    pullHistory,
    showResultScreen,
    masterDataMap,
    encoreTarget,
    setEncoreTarget,
    banner,
    isEncore,
    chargeType,
    currentChargeStack,
    chargeStacks,
    handlePull,
    handleResetHistory,
    handleResetStacks,
    inventorySummary,
  };
}
