'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import type { RaidParty } from '@/types/raid';
import { RaidPartyCard } from '@/components/raid/RaidPartyCard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
export default function RaidDetailPage() {
  const params = useParams();
  const code = params.code as string;
  const router = useRouter();

  const [masterData, setMasterData] = useState<StudentMaster[]>([]);
  const [party, setParty] = useState<RaidParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const { masterData } = await getCachedServerData();
      if (cancelled) return;
      setMasterData(masterData);
      
      try {
        // Try fetching from API first (by shortCode)
        const res = await api.get(`/raids/parties/code/${code}`);
        setParty(res.data);
      } catch (err: any) {
        // If not found by code, try by ID
        try {
          const res2 = await api.get(`/raids/parties`); // Fetching all is inefficient but works as a quick fallback for dev
          const allParties = res2.data as RaidParty[];
          const found = allParties.find(p => p.id.toString() === code);
          if (found) {
            setParty(found);
          } else {
            setError('공략을 찾을 수 없습니다.');
          }
        } catch(e) {
          setError('공략을 찾을 수 없습니다.');
        }
      } finally {
        setLoading(false);
      }
    }
    
    useAuthStore.getState().checkAuth();
    loadData();
    return () => { cancelled = true; };
  }, [code]);

  const handleDelete = async () => {
    if (!party) return;
    if (typeof party.id !== 'number') {
      alert('기본 공략은 삭제할 수 없습니다.');
      return;
    }
    if (!confirm('정말 이 공략을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/raids/parties/${party.id}`);
      alert('공략이 삭제되었습니다.');
      router.push('/raids');
    } catch (err: any) {
      alert(err.response?.data?.error || '삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-[var(--plana-primary)] rounded-full animate-spin"></div>
        <p className="mt-4 text-[var(--plana-primary-dark)] font-bold animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
        <p className="mb-4">{error || '공략을 찾을 수 없습니다.'}</p>
        <Link href="/raids" className="text-purple-600 underline">목록으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 w-full h-full flex flex-col overflow-y-auto">
      <div className="mb-6">
        <Link href="/raids" className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-700 transition-colors font-bold">
          <ArrowLeft size={20} />
          <span>목록으로 돌아가기</span>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto w-full pb-10">
        <RaidPartyCard 
          party={party}
          masterData={masterData}
          isDetail={true}
          onDelete={typeof party.id === 'number' ? handleDelete : undefined}
        />
      </div>
    </div>
  );
}
