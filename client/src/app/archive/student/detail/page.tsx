'use client';



import React, { useEffect, useState } from 'react';
import { useSearchParams,  } from 'next/navigation';
import { getCachedServerData, getCachedSchema } from '@/lib/dataCache';
import type { StudentMaster, SchemaConfig } from '@/types';
import dynamic from 'next/dynamic';

const MasterDetailView = dynamic(() => import('@/components/archive/MasterDetailView').then(m => m.MasterDetailView), { ssr: false });

function ArchiveStudentPageContent() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get('id'));

  const [master, setMaster] = useState<StudentMaster | null>(null);
  const [schema, setSchema] = useState<SchemaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const [{ masterData }, s] = await Promise.all([getCachedServerData(), getCachedSchema()]);
      if (cancelled) return;
      const student = masterData.find(m => m.id === id) || null;
      setMaster(student);
      setSchema(s);
      setLoading(false);
    }
    loadData();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!master || !schema) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-300">학생 정보를 찾을 수 없습니다.</h2>
      </div>
    );
  }

  return <MasterDetailView master={master} schema={schema} />;
}


import { Suspense } from 'react';

export default function ArchiveStudentPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading...</div>}>
      <ArchiveStudentPageContent />
    </Suspense>
  );
}
