'use client';

export const runtime = 'edge';

import React, { useEffect, useState } from 'react';
import { RaidWriteForm } from '@/components/raid/RaidWriteForm';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import type { RaidParty } from '@/types/raid';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function RaidEditPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [masterData, setMasterData] = useState<StudentMaster[]>([]);
  const [partyData, setPartyData] = useState<RaidParty | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const { masterData } = await getCachedServerData();
        if (cancelled) return;
        setMasterData(masterData);

        const id = params?.id as string;
        if (id) {
          const res = await api.get(`/raids/parties/code/${id}`);
          if (cancelled) return;
          const data = res.data;
          
          if (!user || (user.role !== 'ADMIN' && user.id !== data.authorId)) {
            toast.error('수정 권한이 없습니다.');
            router.push('/raids');
            return;
          }
          
          setPartyData(data);
        }
      } catch (err) {
        console.error(err);
        toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
        router.push('/raids');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    useAuthStore.getState().checkAuth();
    if (!useAuthStore.getState().isAuthenticated) {
      toast.error('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    loadData();
    return () => { cancelled = true; };
  }, [params?.id, router, user]);

  if (loading || !partyData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-[var(--plana-primary)] rounded-full animate-spin"></div>
        <p className="mt-4 text-[var(--plana-primary-dark)] font-bold animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <RaidWriteForm masterData={masterData} initialData={partyData} />
    </div>
  );
}
