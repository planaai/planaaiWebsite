import { create } from 'zustand';

interface RaidState {
  selectedMode: string;
  selectedBossId: string | null;
  selectedTerrain: string | null;
  selectedDifficulty: string | null;
  setModeFilter: (mode: string) => void;
  setBossFilter: (bossId: string | null) => void;
  setTerrainFilter: (terrain: string | null) => void;
  setDifficultyFilter: (difficulty: string | null) => void;
}

export const useRaidStore = create<RaidState>((set) => ({
  selectedMode: 'TotalAssault',
  selectedBossId: null,
  selectedTerrain: null,
  selectedDifficulty: null,
  
  setModeFilter: (mode) => set({ selectedMode: mode, selectedBossId: null, selectedTerrain: null, selectedDifficulty: null }),
  setBossFilter: (bossId) => set({ selectedBossId: bossId, selectedTerrain: null, selectedDifficulty: null }),
  setTerrainFilter: (terrain) => set({ selectedTerrain: terrain, selectedDifficulty: null }),
  setDifficultyFilter: (difficulty) => set({ selectedDifficulty: difficulty }),
}));
