import { create } from 'zustand';

interface RaidState {
  selectedBossId: string | null;
  selectedTerrain: string | null;
  selectedDifficulty: string | null;
  setBossFilter: (bossId: string | null) => void;
  setTerrainFilter: (terrain: string | null) => void;
  setDifficultyFilter: (difficulty: string | null) => void;
}

export const useRaidStore = create<RaidState>((set) => ({
  selectedBossId: null,
  selectedTerrain: null,
  selectedDifficulty: null,
  
  setBossFilter: (bossId) => set({ selectedBossId: bossId, selectedTerrain: null, selectedDifficulty: null }),
  setTerrainFilter: (terrain) => set({ selectedTerrain: terrain, selectedDifficulty: null }),
  setDifficultyFilter: (difficulty) => set({ selectedDifficulty: difficulty }),
}));
