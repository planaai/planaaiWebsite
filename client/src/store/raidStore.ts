import { create } from 'zustand';

interface BossFilter {
  terrain: string | null;
  difficulty: string | null;
}

interface RaidState {
  selectedMode: string;
  selectedBossIds: string[];
  bossFilters: Record<string, BossFilter>;
  setModeFilter: (mode: string) => void;
  setBossFilter: (bossId: string) => void;
  setBossTerrain: (bossId: string, terrain: string | null) => void;
  setBossDifficulty: (bossId: string, difficulty: string | null) => void;
}

export const useRaidStore = create<RaidState>((set) => ({
  selectedMode: 'TotalAssault',
  selectedBossIds: [],
  bossFilters: {},
  
  setModeFilter: (mode) => set({ 
    selectedMode: mode, 
    selectedBossIds: [], 
    bossFilters: {} 
  }),
  
  setBossFilter: (bossId) => set((state) => {
    const isSelected = state.selectedBossIds.includes(bossId);
    let newBossIds;
    const newBossFilters = { ...state.bossFilters };

    if (isSelected) {
      newBossIds = state.selectedBossIds.filter(id => id !== bossId);
      delete newBossFilters[bossId];
    } else {
      newBossIds = [...state.selectedBossIds, bossId];
      newBossFilters[bossId] = { terrain: null, difficulty: null };
    }

    if (newBossIds.length === 0) {
      return { selectedBossIds: [], bossFilters: {} };
    }
    return { selectedBossIds: newBossIds, bossFilters: newBossFilters };
  }),

  setBossTerrain: (bossId, terrain) => set((state) => ({
    bossFilters: {
      ...state.bossFilters,
      [bossId]: {
        ...state.bossFilters[bossId],
        terrain,
        difficulty: null // Reset difficulty when terrain changes
      }
    }
  })),

  setBossDifficulty: (bossId, difficulty) => set((state) => ({
    bossFilters: {
      ...state.bossFilters,
      [bossId]: {
        ...state.bossFilters[bossId],
        difficulty
      }
    }
  })),
}));
