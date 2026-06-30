'use client';

import React, { useEffect, useState } from 'react';
import { getCachedServerData, getCachedSchema } from '@/lib/dataCache';
import type { StudentMaster, SchemaConfig } from '@/types';
import { RosterView } from '@/components/archive/RosterView';
import { useArchiveStore } from '@/store/archiveStore';

export default function ArchivePage() {
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
    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-cyan-400 font-bold animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <RosterView initialMasterData={masterData} schema={schema} mode="archive" />
  );
}
