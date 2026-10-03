import { useState, useMemo, useEffect } from 'react';
import { performTenPull, performSinglePull, GachaData } from '@/lib/gachaLogic';
import { fetchGachaStatus } from '@/lib/api';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import { toast } from 'sonner';

export interface GachaResult {
  name: string;
  rarity: 1 | 2 | 3;
  isPickup: boolean;
  isNew?: boolean;
}

export function useGacha() {
  const [gachaData, setGachaData] = useState<GachaData | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [results, setResults] = useState<GachaResult[]>([]);
  const [pullHistory, setPullHistory] = useState<GachaResult[]>([]);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [masterDataMap, setMasterDataMap] = useState<Record<string, StudentMaster>>({});
  const [encoreTarget, setEncoreTarget] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [{ masterData }, gachaStatus] = await Promise.all([
          getCachedServerData(),
          fetchGachaStatus().catch(() => null)
        ]);
        
        if (cancelled) return;

        const map: Record<string, StudentMaster> = {};
        masterData.forEach(student => {
          const normalizedName = student.name.replace(/\s+/g, '');
          map[normalizedName] = student;
        });
        setMasterDataMap(map);

        if (gachaStatus) {
          if (gachaStatus.pools && gachaStatus.pools["3_star"]) {
            gachaStatus.pools["3_star"] = gachaStatus.pools["3_star"].filter(
              (item: any) => {
                const nameStr = typeof item === 'string' ? item : (item?.name || '');
                return typeof nameStr === 'string' && !nameStr.includes('앙코르 모집');
              }
            );
          }
          setGachaData(gachaStatus);
        }
      } catch (err: unknown) {
        if (!cancelled) toast.error('데이터를 불러오는데 실패했습니다.');
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  const banner = gachaData?.banners?.[activeBannerIndex] || gachaData?.banners?.[0];
  const isEncore = banner?.name?.includes('앙코르 모집');

  const handlePull = (type: 'single' | 'ten') => {
    if (!gachaData || !banner) return;
    if (isEncore && !encoreTarget) {
      toast.error('잠시 후에 다시 시도해 주세요');
      return;
    }

    const pullResults = type === 'single' 
      ? performSinglePull(gachaData, activeBannerIndex, encoreTarget) 
      : performTenPull(gachaData, activeBannerIndex, encoreTarget);
    
    setPullHistory(prev => {
      const historyNames = new Set(prev.map(p => p.name));
      const finalResults = pullResults.map(r => ({
          ...r,
          isNew: !historyNames.has(r.name)
      }));
      setResults(finalResults as GachaResult[]);
      return [...prev, ...(finalResults as GachaResult[])];
    });
    setShowResultScreen(true);
  };

  const handleReset = () => {
    setResults([]);
    setPullHistory([]);
    setShowResultScreen(false);
  };

  const inventorySummary = useMemo(() => {
    const summary: Record<string, { count: number; rarity: number; isPickup: boolean }> = {};
    pullHistory.forEach(r => {
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
    handlePull,
    handleReset,
    inventorySummary
  };
}
