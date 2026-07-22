import React, { useEffect, useState } from 'react';
import type { StudentMaster } from '@/types';
import { useRaidStore } from '@/store/raidStore';
import { RaidFilterPanel } from './RaidFilterPanel';
import { RaidPartyCard } from './RaidPartyCard';
import raidData from '@/data/raids.json';
import { api } from '@/lib/api';
import type { RaidBoss, RaidSeasonData, RaidParty } from '@/types/raid';

interface Props {
  masterData: StudentMaster[];
}

import Link from 'next/link';
import { Edit3 } from 'lucide-react';

export function RaidRecommendationView({ masterData }: Props) {
  const { selectedBossId, selectedTerrain, selectedDifficulty } = useRaidStore();
  const [parties, setParties] = useState<RaidParty[]>([]);
  const [loading, setLoading] = useState(false);

  const bosses = raidData.bosses as RaidBoss[];
  const seasons = raidData.seasons as RaidSeasonData[];

  useEffect(() => {
    async function fetchParties() {
      if (!selectedBossId || !selectedTerrain || !selectedDifficulty) {
        setParties([]);
        return;
      }
      
      setLoading(true);
      try {
        const res = await api.get('/raids/parties', {
          params: { bossId: selectedBossId, terrain: selectedTerrain, difficulty: selectedDifficulty }
        });
        setParties(res.data);
      } catch (err) {
        console.error('Failed to fetch parties:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchParties();
  }, [selectedBossId, selectedTerrain, selectedDifficulty]);

  // Merge static default parties (if they match the filter) and dynamic API parties
  const filteredStaticSeasons = seasons.filter(season => {
    if (selectedBossId && season.bossId !== selectedBossId) return false;
    if (selectedTerrain && season.terrain !== selectedTerrain) return false;
    if (selectedDifficulty && season.difficulty !== selectedDifficulty) return false;
    return true;
  });
  
  const staticParties = filteredStaticSeasons.flatMap(s => s.parties);
  const partiesToDisplay = [...staticParties, ...parties];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 w-full h-full flex flex-col overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">총력전 / 대결전 조합 추천</h1>
        <Link 
          href="/raids/write"
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-all"
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
          <h2 className="text-xl font-bold text-white mb-2">추천 파티 리스트</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {partiesToDisplay.map((party) => (
              <RaidPartyCard 
                key={party.id}
                party={party}
                masterData={masterData}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
