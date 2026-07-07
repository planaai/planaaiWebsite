import { create } from 'zustand';

interface FilterState {
  searchQuery: string;
  filterSchool: string;
  filterRole: string;
  filterFieldType: string;
  filterOwned: 'owned' | 'unowned';
}

interface RosterFilterStore {
  collection: FilterState;
  archive: FilterState;
  setFilter: (mode: 'collection' | 'archive', key: keyof FilterState, value: string) => void;
}

const initialFilterState: FilterState = {
  searchQuery: '',
  filterSchool: '',
  filterRole: '',
  filterFieldType: '',
  filterOwned: 'owned',
};

export const useRosterFilterStore = create<RosterFilterStore>((set) => ({
  collection: { ...initialFilterState },
  archive: { ...initialFilterState },
  setFilter: (mode, key, value) => set((state) => ({
    [mode]: {
      ...state[mode],
      [key]: value
    }
  }))
}));
