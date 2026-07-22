'use client';

import React, { useEffect, useState } from 'react';
import { RaidWriteForm } from '@/components/raid/RaidWriteForm';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import { useAuthStore } from '@/store/authStore';

export default function RaidWritePage() {
  const [masterData, setMasterData] = useState<StudentMaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const { masterData } = await getCachedServerData();
      if (cancelled) return;
      setMasterData(masterData);
      setLoading(false);
    }
    
    useAuthStore.getState().checkAuth();
    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-[var(--plana-primary)] rounded-full animate-spin"></div>
        <p className="mt-4 text-[var(--plana-primary-dark)] font-bold animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-[var(--plana-bg-dark)] overflow-hidden">
      <RaidWriteForm masterData={masterData} />
    </div>
  );
}
