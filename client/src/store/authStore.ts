import { create } from 'zustand';
import { fetchCurrentUser } from '@/lib/api';

interface User {
  id: number;
  uid: number;
  username: string;
  nickname?: string;
  role: 'USER' | 'ADMIN';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateNickname: (nickname: string) => void;
  setUser: (user: User) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    set({ user: null, isAuthenticated: false });
  },
  updateNickname: (nickname) => set((state) => ({
    user: state.user ? { ...state.user, nickname } : null
  })),
  setUser: (user) => set({ user, isAuthenticated: true }),
  checkAuth: async () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const res = await fetchCurrentUser();
          // Assuming backend returns { success: true, user: {...} } or directly user
          const userData = res.user || res;
          set({ user: userData, isAuthenticated: true });
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('auth_token');
          set({ user: null, isAuthenticated: false });
        }
      }
    }
  }
}));
