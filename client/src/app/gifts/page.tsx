'use client';

import React, { useEffect, useState } from 'react';
import { fetchServerData, fetchSchema } from '@/lib/api';
import type { StudentMaster, SchemaConfig } from '@/types';
import { GiftsView } from '@/components/archive/GiftsView';
import { useArchiveStore } from '@/store/archiveStore';

export default function GiftsPage() {
  const [masterData, setMasterData] = useState<StudentMaster[]>([]);
  const [schema, setSchema] = useState<SchemaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [{ masterData, archiveData }, s] = await Promise.all([fetchServerData(), fetchSchema()]);
      setMasterData(masterData);
      setSchema(s);
      
      // Auto-sync from server for testing
      if (archiveData && archiveData.length > 0) {
        useArchiveStore.getState().syncFromServer(archiveData);
      }
      
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-pink-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-pink-400 font-bold animate-pulse">선물 도감 불러오는 중...</p>
      </div>
    );
  }

  return (
    <GiftsView initialMasterData={masterData} schema={schema!} />
  );
}
