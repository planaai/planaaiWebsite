import React, { useState } from 'react';
import { useRaidStore } from '@/store/raidStore';
import { getImageUrl } from '@/components/planner/utils';
import type { RaidBoss, RaidSeasonData } from '@/types/raid';
import { ChevronDown, ChevronUp } from 'lucide-react';

const DIFFICULTY_ORDER = ['Normal', 'Hard', 'VeryHard', 'Hardcore', 'Extreme', 'Insane', 'Torment', 'Lunatic'];

const sortDifficulties = (a: string, b: string) => {
  const indexA = DIFFICULTY_ORDER.indexOf(a);
  const indexB = DIFFICULTY_ORDER.indexOf(b);
  
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
  
  return a.localeCompare(b);
};

interface Props {
  bosses: RaidBoss[];
  seasons: RaidSeasonData[];
}

export function RaidFilterPanel({ bosses, seasons }: Props) {
  const [isBossListExpanded, setIsBossListExpanded] = useState(true);
  
  const { 
    selectedMode,
    selectedBossIds, 
    bossFilters,
    setModeFilter,
    setBossFilter, 
    setBossTerrain, 
    setBossDifficulty 
  } = useRaidStore();

  return (
    <div className="bg-white/80 backdrop-blur border border-gray-200 shadow-sm rounded-lg p-4 mb-6 transition-all duration-300">
      <div className="flex gap-4 border-b border-gray-200 pb-4 mb-4">
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
                ? 'border-pink-400 text-pink-600 bg-pink-50'
                : 'border-transparent text-gray-500 hover:text-pink-500 hover:bg-pink-50/50'
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
        <div className="flex flex-wrap gap-4 mb-4 animate-in slide-in-from-top-2 fade-in duration-200">
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
              className={`relative flex items-end p-3 rounded-xl border-4 overflow-hidden transition-all text-left ${
                selectedBossIds.includes(boss.id)
                  ? 'border-pink-500 shadow-lg ring-2 ring-pink-300 ring-offset-2 scale-[1.02] z-10' 
                  : 'border-transparent hover:border-pink-300 hover:shadow-md hover:scale-[1.02] hover:z-10 z-0'
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

      {selectedBossIds.length > 0 && (
        <div className="flex flex-col gap-4 border-t border-gray-200 pt-4">
          {selectedBossIds.map(bossId => {
            const boss = bosses.find(b => b.id === bossId);
            if (!boss) return null;
            
            const currentFilter = bossFilters[bossId] || { terrain: null, difficulty: null };
            
            const availableTerrains = Array.from(new Set(seasons.filter(s => s.bossId === bossId).map(s => s.terrain)));
            const availableDifficulties = currentFilter.terrain
              ? Array.from(new Set(seasons.filter(s => s.bossId === bossId && s.terrain === currentFilter.terrain).map(s => s.difficulty))).sort(sortDifficulties)
              : [];
              
            return (
              <div key={bossId} className="flex flex-col md:flex-row gap-4 md:gap-8 items-start md:items-center bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="font-bold text-gray-700 w-32 shrink-0">{boss.name}</div>
                <div className="flex flex-col md:flex-row gap-4 md:gap-8 flex-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 font-bold">지형</span>
                    <div className="flex flex-wrap gap-2">
                      {availableTerrains.map((terrain) => (
                        <button
                          key={terrain}
                          onClick={() => setBossTerrain(bossId, currentFilter.terrain === terrain ? null : terrain)}
                          className={`px-3 py-1 rounded border text-sm transition-colors shadow-sm ${
                            currentFilter.terrain === terrain 
                              ? 'bg-green-600 border-green-500 text-white' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-pink-50 hover:border-pink-200 hover:text-pink-600'
                          }`}
                        >
                          {terrain === 'Urban' ? '시가전' : terrain === 'Outdoor' ? '야전' : '실내전'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {currentFilter.terrain && (
                    <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-left-2">
                      <span className="text-xs text-gray-500 font-bold">난이도</span>
                      <div className="flex flex-wrap gap-2">
                        {availableDifficulties.map((difficulty) => (
                          <button
                            key={difficulty}
                            onClick={() => setBossDifficulty(bossId, currentFilter.difficulty === difficulty ? null : difficulty)}
                            className={`px-3 py-1 rounded border text-sm transition-colors shadow-sm ${
                              currentFilter.difficulty === difficulty 
                                ? 'bg-red-600 border-red-500 text-white' 
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-pink-50 hover:border-pink-200 hover:text-pink-600'
                            }`}
                          >
                            {difficulty}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
