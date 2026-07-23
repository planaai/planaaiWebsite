import React, { useState } from 'react';
import { useRaidStore } from '@/store/raidStore';
import { getImageUrl } from '@/components/planner/utils';
import type { RaidBoss, RaidSeasonData } from '@/types/raid';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  bosses: RaidBoss[];
  seasons: RaidSeasonData[];
}

export function RaidFilterPanel({ bosses, seasons }: Props) {
  const [isBossListExpanded, setIsBossListExpanded] = useState(true);
  
  const { 
    selectedMode,
    selectedBossId, 
    selectedTerrain, 
    selectedDifficulty, 
    setModeFilter,
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
    <div className="bg-white/80 backdrop-blur border border-purple-100 shadow-sm rounded-lg p-4 mb-6 transition-all duration-300">
      <div className="flex gap-4 border-b border-purple-100 pb-4 mb-4">
        {[
          { id: 'TotalAssault', label: '총력전' },
          { id: 'GrandAssault', label: '대결전' },
          { id: 'LimitBreakAssault', label: '제약해제결전' }
        ].map(mode => (
          <button
            key={mode.id}
            onClick={() => setModeFilter(mode.id)}
            className={`px-4 py-2 font-bold rounded-t-lg transition-colors border-b-2 ${
              selectedMode === mode.id
                ? 'border-purple-600 text-purple-700 bg-purple-50'
                : 'border-transparent text-gray-500 hover:text-purple-600 hover:bg-purple-50/50'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
      
      <div 
        className="flex justify-between items-center cursor-pointer mb-4 select-none"
        onClick={() => setIsBossListExpanded(!isBossListExpanded)}
      >
        <h2 className="text-xl font-bold text-gray-800">보스 선택</h2>
        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          {isBossListExpanded ? <ChevronUp className="text-gray-500" size={20} /> : <ChevronDown className="text-gray-500" size={20} />}
        </button>
      </div>
      
      {isBossListExpanded && (
        <div className="flex flex-wrap gap-3 mb-4 animate-in slide-in-from-top-2 fade-in duration-200">
          {bosses
            .filter(boss => {
              if (selectedMode === 'LimitBreakAssault') return boss.category === 'LimitBreak';
              return boss.category !== 'LimitBreak'; // For Total and Grand Assault
            })
            .map((boss) => (
            <button
              key={boss.id}
              onClick={() => {
                setBossFilter(boss.id);
              }}
              className={`relative flex items-end p-3 rounded-xl border-2 overflow-hidden transition-all text-left ${
                selectedBossId === boss.id 
                  ? 'border-blue-500 shadow-md ring-2 ring-blue-300 ring-offset-2' 
                  : 'border-transparent hover:border-purple-300 hover:shadow-sm'
              }`}
              style={{ width: '180px', height: '100px' }}
            >
              {boss.bannerUrl ? (
                <img src={getImageUrl(boss.bannerUrl)} alt={boss.name} className="absolute inset-0 w-full h-full object-cover z-0" />
              ) : (
                <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 z-0"></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10"></div>
              <div className="relative z-20 w-full">
                <span className="font-bold text-white text-lg drop-shadow-md leading-tight block">{boss.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedBossId && (
        <div className="flex gap-8 border-t border-purple-100 pt-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-gray-500">지형</span>
            <div className="flex gap-2">
              {availableTerrains.map((terrain) => (
                <button
                  key={terrain}
                  onClick={() => setTerrainFilter(terrain)}
                  className={`px-3 py-1 rounded border text-sm transition-colors ${
                    selectedTerrain === terrain 
                      ? 'bg-green-600 border-green-500 text-white' 
                      : 'bg-white border-purple-200 text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  {terrain === 'Urban' ? '시가전' : terrain === 'Outdoor' ? '야전' : '실내전'}
                </button>
              ))}
            </div>
          </div>

          {selectedTerrain && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-500">난이도</span>
              <div className="flex gap-2">
                {availableDifficulties.map((difficulty) => (
                  <button
                    key={difficulty}
                    onClick={() => setDifficultyFilter(difficulty)}
                    className={`px-3 py-1 rounded border text-sm transition-colors ${
                      selectedDifficulty === difficulty 
                        ? 'bg-red-600 border-red-500 text-white' 
                        : 'bg-white border-purple-200 text-gray-600 hover:bg-purple-50 hover:text-purple-700'
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
