import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export type FormationMode = 'normal' | 'raid' | 'elimination';
export type RosterType = 'collection' | 'all';

export interface Team {
  id: string;
  name: string;
  strikers: (number | null)[];
  specials: (number | null)[];
}

export interface FormationState {
  mode: FormationMode;
  rosterType: RosterType;
  teams: Team[];
  activeTeamId: string;
  selectedSlot: { teamId: string; type: 'striker' | 'special'; index: number } | null;
  savedFormations: Record<string, { teams: Team[], activeTeamId: string }>;
  imageOffsets: Record<string, { scale: number; offsetX: number; offsetY: number }>;

  setMode: (mode: FormationMode) => void;
  setRosterType: (type: RosterType) => void;
  setActiveTeam: (id: string) => void;
  setSelectedSlot: (slot: { teamId: string; type: 'striker' | 'special'; index: number } | null) => void;

  resetTeams: () => void;
  addTeam: () => void;
  removeTeam: (id: string) => void;
  updateTeamName: (id: string, name: string) => void;

  assignStudent: (teamId: string, type: 'striker' | 'special', index: number, studentId: number) => void;
  removeStudent: (teamId: string, type: 'striker' | 'special', index: number) => void;
  swapStudents: (teamId1: string, type1: 'striker' | 'special', index1: number, teamId2: string, type2: 'striker' | 'special', index2: number) => void;
  fetchImageOffsets: () => Promise<void>;
  studentModes: Record<number, number>;
  setStudentMode: (studentId: number, modeIndex: number) => void;
  importTeam: (strikers: (number | null)[], specials: (number | null)[]) => void;
  getAllFormations: () => Record<string, { teams: Team[], activeTeamId: string }>;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const createEmptyTeam = (name: string, mode: FormationMode): Team => {
  const strikerCount = mode === 'elimination' ? 6 : 4;
  const specialCount = mode === 'elimination' ? 4 : 2;
  return {
    id: generateId(),
    name,
    strikers: Array(strikerCount).fill(null),
    specials: Array(specialCount).fill(null),
  };
};

export const useFormationStore = create<FormationState>()(
  persist(
    (set, get) => ({
      mode: 'normal',
      rosterType: 'collection',
      teams: [createEmptyTeam('1부대', 'normal')],
      activeTeamId: '',
      selectedSlot: null,
      savedFormations: {},
      imageOffsets: {},
      studentModes: {},

      setStudentMode: (studentId, modeIndex) => 
        set((state) => ({
          studentModes: { ...state.studentModes, [studentId]: modeIndex }
        })),

      getAllFormations: () => {
        const state = get();
        const currentKey = `${state.mode}_${state.rosterType}`;
        return {
          ...state.savedFormations,
          [currentKey]: { teams: state.teams, activeTeamId: state.activeTeamId }
        };
      },

      setMode: (newMode) =>
        set((state) => {
          if (state.mode === newMode) return state;
          
          const currentKey = `${state.mode}_${state.rosterType}`;
          const nextKey = `${newMode}_${state.rosterType}`;
          
          const newSaved = {
            ...state.savedFormations,
            [currentKey]: { teams: state.teams, activeTeamId: state.activeTeamId }
          };
          
          let nextTeams, nextActiveId;
          if (newSaved[nextKey]) {
            nextTeams = newSaved[nextKey].teams;
            nextActiveId = newSaved[nextKey].activeTeamId;
          } else {
            const newTeam = createEmptyTeam('1부대', newMode);
            nextTeams = [newTeam];
            nextActiveId = newTeam.id;
          }

          return { 
            mode: newMode, 
            teams: nextTeams, 
            activeTeamId: nextActiveId, 
            savedFormations: newSaved, 
            selectedSlot: null 
          };
        }),

      setRosterType: (newRosterType) =>
        set((state) => {
          if (state.rosterType === newRosterType) return state;
          
          const currentKey = `${state.mode}_${state.rosterType}`;
          const nextKey = `${state.mode}_${newRosterType}`;
          
          const newSaved = {
            ...state.savedFormations,
            [currentKey]: { teams: state.teams, activeTeamId: state.activeTeamId }
          };
          
          let nextTeams, nextActiveId;
          if (newSaved[nextKey]) {
            nextTeams = newSaved[nextKey].teams;
            nextActiveId = newSaved[nextKey].activeTeamId;
          } else {
            const newTeam = createEmptyTeam('1부대', state.mode);
            nextTeams = [newTeam];
            nextActiveId = newTeam.id;
          }

          return { 
            rosterType: newRosterType, 
            teams: nextTeams, 
            activeTeamId: nextActiveId, 
            savedFormations: newSaved, 
            selectedSlot: null 
          };
        }),

      setActiveTeam: (id) => set({ activeTeamId: id, selectedSlot: null }),

      setSelectedSlot: (selectedSlot) => set({ selectedSlot }),

      resetTeams: () =>
        set((state) => {
          const newTeam = createEmptyTeam('1부대', state.mode);
          return { teams: [newTeam], activeTeamId: newTeam.id, selectedSlot: null };
        }),

      addTeam: () =>
        set((state) => {
          if (state.teams.length >= 20) return state; // Max 20 teams
          const newTeam = createEmptyTeam(`${state.teams.length + 1}부대`, state.mode);
          return {
            teams: [...state.teams, newTeam],
            activeTeamId: newTeam.id,
          };
        }),

      removeTeam: (id) =>
        set((state) => {
          if (state.teams.length <= 1) return state; // Min 1 team
          const newTeams = state.teams.filter((t) => t.id !== id);
          const activeTeamId = state.activeTeamId === id ? newTeams[0].id : state.activeTeamId;
          return { teams: newTeams, activeTeamId, selectedSlot: null };
        }),

      updateTeamName: (id, name) =>
        set((state) => ({
          teams: state.teams.map((t) => (t.id === id ? { ...t, name } : t)),
        })),

      assignStudent: (teamId, type, index, studentId) =>
        set((state) => {
          const newTeams = [...state.teams];
          const teamIndex = newTeams.findIndex((t) => t.id === teamId);
          if (teamIndex === -1) return state;

          const team = { ...newTeams[teamIndex], strikers: [...newTeams[teamIndex].strikers], specials: [...newTeams[teamIndex].specials] };
          
          // In raid mode, characters can only be used once across ALL teams.
          // In normal/elimination, characters can only be used once per team.
          if (state.mode === 'raid') {
            newTeams.forEach((t, tIdx) => {
              newTeams[tIdx] = { ...t, strikers: [...t.strikers], specials: [...t.specials] };
              newTeams[tIdx].strikers = newTeams[tIdx].strikers.map((id) => (id === studentId ? null : id));
              newTeams[tIdx].specials = newTeams[tIdx].specials.map((id) => (id === studentId ? null : id));
            });
          } else {
            // Remove from current team if they exist
            team.strikers = team.strikers.map((id) => (id === studentId ? null : id));
            team.specials = team.specials.map((id) => (id === studentId ? null : id));
          }

          if (type === 'striker') {
            team.strikers[index] = studentId;
          } else {
            team.specials[index] = studentId;
          }

          newTeams[teamIndex] = team;
          
          return { teams: newTeams, selectedSlot: null };
        }),

      removeStudent: (teamId, type, index) =>
        set((state) => {
          const newTeams = [...state.teams];
          const teamIndex = newTeams.findIndex((t) => t.id === teamId);
          if (teamIndex === -1) return state;

          const team = { ...newTeams[teamIndex], strikers: [...newTeams[teamIndex].strikers], specials: [...newTeams[teamIndex].specials] };
          
          if (type === 'striker') {
            team.strikers[index] = null;
          } else {
            team.specials[index] = null;
          }

          newTeams[teamIndex] = team;
          return { teams: newTeams };
        }),

      swapStudents: (teamId1, type1, index1, teamId2, type2, index2) =>
        set((state) => {
          if (type1 !== type2) return state; // Can only swap strikers with strikers, specials with specials
          
          const newTeams = [...state.teams];
          const team1Index = newTeams.findIndex((t) => t.id === teamId1);
          const team2Index = newTeams.findIndex((t) => t.id === teamId2);
          
          if (team1Index === -1 || team2Index === -1) return state;

          const team1 = { ...newTeams[team1Index], strikers: [...newTeams[team1Index].strikers], specials: [...newTeams[team1Index].specials] };
          const team2 = teamId1 === teamId2 ? team1 : { ...newTeams[team2Index], strikers: [...newTeams[team2Index].strikers], specials: [...newTeams[team2Index].specials] };

          const array1 = type1 === 'striker' ? team1.strikers : team1.specials;
          const array2 = type2 === 'striker' ? team2.strikers : team2.specials;

          const temp = array1[index1];
          array1[index1] = array2[index2];
          array2[index2] = temp;

          newTeams[team1Index] = team1;
          if (teamId1 !== teamId2) {
            newTeams[team2Index] = team2;
          }

          return { teams: newTeams };
        }),

      fetchImageOffsets: async () => {
        try {
          const res = await api.get('/image-offsets');
          set({ imageOffsets: res.data || {} });
        } catch (err) {
          console.error('Failed to fetch image offsets:', err);
        }
      },

      importTeam: (strikers, specials) =>
        set((state) => {
          if (!state.activeTeamId) return state;
          const newTeams = [...state.teams];
          const teamIndex = newTeams.findIndex((t) => t.id === state.activeTeamId);
          if (teamIndex === -1) return state;

          const team = { ...newTeams[teamIndex] };
          team.strikers = [...strikers];
          team.specials = [...specials];
          
          // Ensure arrays match mode size if needed
          const strikerCount = state.mode === 'elimination' ? 6 : 4;
          const specialCount = state.mode === 'elimination' ? 4 : 2;
          
          while (team.strikers.length < strikerCount) team.strikers.push(null);
          while (team.specials.length < specialCount) team.specials.push(null);
          
          if (team.strikers.length > strikerCount) team.strikers = team.strikers.slice(0, strikerCount);
          if (team.specials.length > specialCount) team.specials = team.specials.slice(0, specialCount);

          newTeams[teamIndex] = team;
          return { teams: newTeams };
        }),
    }),
    {
      name: 'formation-storage',
      onRehydrateStorage: () => (state) => {
        if (state && !state.activeTeamId && state.teams.length > 0) {
          state.setActiveTeam(state.teams[0].id);
        }
      }
    }
  )
);
