import React, { useEffect, useState } from 'react';
import type { StudentMaster } from '@/types';
import { useRaidStore } from '@/store/raidStore';
import { RaidFilterPanel } from './RaidFilterPanel';
import { RaidPartyCard } from './RaidPartyCard';
import { api } from '@/lib/api';
import type { RaidBoss, RaidSeasonData, RaidParty } from '@/types/raid';

interface Props {
  masterData: StudentMaster[];
}

import Link from 'next/link';
import { Edit3 } from 'lucide-react';

export function RaidRecommendationView({ masterData }: Props) {
  const { selectedMode, selectedBossId, selectedTerrain, selectedDifficulty } = useRaidStore();
  const [parties, setParties] = useState<RaidParty[]>([]);
  const [bosses, setBosses] = useState<RaidBoss[]>([]);
  const [seasons, setSeasons] = useState<RaidSeasonData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await api.get('/raids/meta');
        setBosses(res.data.bosses);
        setSeasons(res.data.seasons);
      } catch (err) {
        console.error('Failed to fetch raid meta:', err);
      }
    }
    fetchMeta();
  }, []);

  useEffect(() => {
    async function fetchParties() {
      if (!selectedBossId || !selectedTerrain || !selectedDifficulty) {
        setParties([]);
        return;
      }
      
      setLoading(true);
      try {
        const res = await api.get('/raids/parties', {
          params: { mode: selectedMode, bossId: selectedBossId, terrain: selectedTerrain, difficulty: selectedDifficulty }
        });
        setParties(res.data);
      } catch (err) {
        console.error('Failed to fetch parties:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchParties();
  }, [selectedMode, selectedBossId, selectedTerrain, selectedDifficulty]);

  const handleDeleteParty = async (id: number) => {
    if (!confirm('정말 이 공략을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/raids/parties/${id}`);
      setParties(prev => prev.filter(p => p.id !== id));
      alert('공략이 삭제되었습니다.');
    } catch (err: any) {
      alert(err.response?.data?.error || '삭제 중 오류가 발생했습니다.');
    }
  };

  // Display only dynamic API parties (user requested to remove static defaults)
  const partiesToDisplay = parties;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 w-full h-full flex flex-col overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">총력전 / 대결전 조합 추천</h1>
        <Link 
          href="/raids/write"
          className="flex items-center gap-2 bg-white/80 backdrop-blur border border-pink-200 hover:border-pink-300 hover:bg-pink-50 text-pink-400 px-4 py-2 rounded-lg font-bold shadow-sm transition-all"
        >
          <Edit3 size={18} />
          <span>공략 작성하기</span>
        </Link>
      </div>
      <div className="mb-6">
        <p className="text-gray-400 text-sm">
          인기 있는 클리어 파티를 확인하고 모의 편성으로 즉시 불러와 나의 스펙에 맞게 덱을 테스트해보세요.
        </p>
      </div>

      <RaidFilterPanel bosses={bosses} seasons={seasons} />

      {!selectedBossId && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          위에서 공략을 확인할 보스를 선택해주세요.
        </div>
      )}

      {selectedBossId && partiesToDisplay.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          해당 조건에 일치하는 파티 공략이 없습니다.
        </div>
      )}

      {selectedBossId && loading && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          공략을 불러오는 중입니다...
        </div>
      )}

      {selectedBossId && partiesToDisplay.length > 0 && !loading && (
        <div className="flex flex-col gap-4 pb-10">
          <h2 className="text-xl font-bold text-gray-800 mb-2">추천 파티 리스트</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {partiesToDisplay.map((party) => (
              <RaidPartyCard 
                key={party.id || party.name}
                party={party}
                masterData={masterData}
                onDelete={typeof party.id === 'number' ? () => handleDeleteParty(party.id as number) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
