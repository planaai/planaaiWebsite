import React from 'react';
import { useRaidStore } from '@/store/raidStore';
import type { RaidBoss, RaidSeasonData } from '@/types/raid';

interface Props {
  bosses: RaidBoss[];
  seasons: RaidSeasonData[];
}

export function RaidFilterPanel({ bosses, seasons }: Props) {
  const { 
    selectedBossId, 
    selectedTerrain, 
    selectedDifficulty, 
    setBossFilter, 
    setTerrainFilter, 
    setDifficultyFilter 
  } = useRaidStore();

  const availableTerrains = selectedBossId 
    ? Array.from(new Set(seasons.filter(s => s.bossId === selectedBossId).map(s => s.terrain)))
    : [];

  const availableDifficulties = (selectedBossId && selectedTerrain)
    ? Array.from(new Set(seasons.filter(s => s.bossId === selectedBossId && s.terrain === selectedTerrain).map(s => s.difficulty)))
    : [];

  return (
    <div className="bg-[#1C2532] border border-[#2D3748] rounded-lg p-4 mb-6">
      <h2 className="text-xl font-bold text-white mb-4">보스 선택</h2>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {bosses.map((boss) => (
          <button
            key={boss.id}
            onClick={() => setBossFilter(boss.id)}
            className={`flex items-center px-4 py-2 rounded border transition-colors ${
              selectedBossId === boss.id 
                ? 'bg-blue-600 border-blue-500 text-white' 
                : 'bg-[#2D3748] border-[#4A5568] text-gray-300 hover:bg-[#3d4b63]'
            }`}
          >
            {boss.name}
          </button>
        ))}
      </div>

      {selectedBossId && (
        <div className="flex gap-8 border-t border-[#2D3748] pt-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-gray-400">지형</span>
            <div className="flex gap-2">
              {availableTerrains.map((terrain) => (
                <button
                  key={terrain}
                  onClick={() => setTerrainFilter(terrain)}
                  className={`px-3 py-1 rounded border text-sm transition-colors ${
                    selectedTerrain === terrain 
                      ? 'bg-green-600 border-green-500 text-white' 
                      : 'bg-[#2D3748] border-[#4A5568] text-gray-300 hover:bg-[#3d4b63]'
                  }`}
                >
                  {terrain === 'Urban' ? '시가전' : terrain === 'Outdoor' ? '야전' : '실내전'}
                </button>
              ))}
            </div>
          </div>

          {selectedTerrain && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-400">난이도</span>
              <div className="flex gap-2">
                {availableDifficulties.map((difficulty) => (
                  <button
                    key={difficulty}
                    onClick={() => setDifficultyFilter(difficulty)}
                    className={`px-3 py-1 rounded border text-sm transition-colors ${
                      selectedDifficulty === difficulty 
                        ? 'bg-red-600 border-red-500 text-white' 
                        : 'bg-[#2D3748] border-[#4A5568] text-gray-300 hover:bg-[#3d4b63]'
                    }`}
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
