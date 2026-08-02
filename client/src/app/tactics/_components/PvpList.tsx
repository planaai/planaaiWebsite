'use client';

import React, { useEffect, useState } from 'react';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { PvpPartyCard } from '@/components/pvp/PvpPartyCard';
import { api } from '@/lib/api';
import type { PvpParty } from '@/types/pvp';
import Link from 'next/link';
import { Edit3, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function PvpList() {
  const [masterData, setMasterData] = useState<StudentMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<PvpParty[]>([]);
  const [deckType, setDeckType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearchQuery(searchQuery);
  };

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const { masterData } = await getCachedServerData();
      if (cancelled) return;
      setMasterData(masterData);
    }
    
    useAuthStore.getState().checkAuth();
    loadData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    async function fetchParties() {
      setLoading(true);
      try {
        const params: any = {};
        if (appliedSearchQuery) params.q = appliedSearchQuery;
        if (deckType) params.deckType = deckType;
        if (!appliedSearchQuery) params.sort = 'popular';

        const res = await api.get('/pvp/parties', { params });
        setParties(res.data);
      } catch (err) {
        console.error('Failed to fetch parties:', err);
        toast.error('공략 목록을 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    fetchParties();
  }, [deckType, appliedSearchQuery]);

  const handleDeleteParty = async (id: number) => {
    if (!confirm('정말 이 공략을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/pvp/parties/${id}`);
      setParties(prev => prev.filter(p => p.id !== id));
      toast.success('공략이 삭제되었습니다.');
    } catch (err: any) {
      toast.error('오류가 발생했습니다.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 w-full h-full flex flex-col overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">PvP 조합 추천</h1>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearch} className="flex relative flex-1 md:flex-none">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목, 작성자, 숏코드 검색..."
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 w-full md:w-64 shadow-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </form>
          <Link href="/tactics/pvp/write" className="flex items-center justify-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold rounded-lg shadow-sm transition-colors shrink-0">
            <Edit3 className="w-4 h-4" />
            <span className="hidden sm:inline">글쓰기</span>
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['', 'Attack', 'Defense'].map((type) => (
          <button
            key={type}
            onClick={() => setDeckType(type)}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${deckType === type ? 'bg-slate-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {type === '' ? '전체' : type === 'Attack' ? '공격 덱' : '방어 덱'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-pink-500 rounded-full animate-spin"></div>
        </div>
      ) : parties.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
          {parties.map(party => (
            <div key={party.id}>
              <PvpPartyCard 
                party={party} 
                masterData={masterData} 
                onDelete={() => party.id && handleDeleteParty(party.id)} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
