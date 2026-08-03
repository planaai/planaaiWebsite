'use client';



import React, { useEffect, useState } from 'react';
import { RaidWriteForm } from '@/components/raid/RaidWriteForm';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import type { RaidParty } from '@/types/raid';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

function RaidEditPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [masterData, setMasterData] = useState<StudentMaster[]>([]);
  const [partyData, setPartyData] = useState<RaidParty | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        await useAuthStore.getState().checkAuth();
        const currentUser = useAuthStore.getState().user;
        const currentIsAuth = useAuthStore.getState().isAuthenticated;

        if (!currentIsAuth) {
          toast.error('로그인이 필요합니다.');
          router.push('/login');
          return;
        }

        const { masterData } = await getCachedServerData();
        if (cancelled) return;
        setMasterData(masterData);

        const id = searchParams.get('id') as string;
        if (id) {
          const res = await api.get(`/raids/parties/code/${id}`);
          if (cancelled) return;
          const data = res.data;
          
          if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== data.authorId)) {
            console.error('Permission check failed. currentUser:', currentUser, 'authorId:', data.authorId);
            toast.error(`권한 실패: current=${currentUser?.id}, author=${data.authorId}`);
            setLoading(false);
            return;
          }
          
          setPartyData(data);
        }
      } catch (err: any) {
        console.error('Failed to load edit data:', err, err.response?.data);
        toast.error(`오류 발생: ${err.message}`);
        setLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    loadData();
    return () => { cancelled = true; };
  }, [searchParams.get('id'), router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-[var(--plana-primary)] rounded-full animate-spin"></div>
        <p className="mt-4 text-[var(--plana-primary-dark)] font-bold animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!partyData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="mt-4 text-red-500 font-bold">오류: 공략 데이터를 불러올 수 없습니다. (권한 혹은 네트워크 문제)</p>
        <button onClick={() => router.push('/tactics?mode=pve')} className="mt-4 px-4 py-2 bg-slate-200 rounded">홈으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <RaidWriteForm masterData={masterData} initialData={partyData} />
    </div>
  );
}


import { Suspense } from 'react';

export default function RaidEditPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading...</div>}>
      <RaidEditPageContent />
    </Suspense>
  );
}
