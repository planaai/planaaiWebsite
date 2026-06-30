'use client';

import React, { useEffect, useState } from 'react';
import { getCachedServerData, getCachedSchema } from '@/lib/dataCache';
import type { StudentMaster, SchemaConfig } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useArchiveStore } from '@/store/archiveStore';
import SyncPanel from '@/components/SyncPanel';
import { FormationBuilder } from '@/components/formation/FormationBuilder';

export default function FormationPage() {
  const [masterData, setMasterData] = useState<StudentMaster[]>([]);
  const [schema, setSchema] = useState<SchemaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const [{ masterData, archiveData }, s] = await Promise.all([getCachedServerData(), getCachedSchema()]);
      if (cancelled) return;
      setMasterData(masterData);
      setSchema(s);
      

      
      setLoading(false);
    }
    
    useAuthStore.getState().checkAuth();
    loadData();
    return () => { cancelled = true; };
  }, []);

  const { isAuthenticated } = useAuthStore();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-[var(--plana-primary)] rounded-full animate-spin"></div>
        <p className="mt-4 text-[var(--plana-primary-dark)] font-bold animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated && <SyncPanel />}
      <FormationBuilder masterData={masterData} schema={schema} />
    </>
  );
}
