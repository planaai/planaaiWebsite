import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ArchiveRecord } from '../types';

import { syncCollectionToServer, fetchCollectionFromServer } from '../lib/api';

import { useAuthStore } from './authStore';

interface ArchiveState {
  records: Record<number, ArchiveRecord>;
  lastSyncTimes: Record<string, string>;
  autoSyncEnabled: boolean;
  setRecord: (studentId: number, record: Partial<ArchiveRecord>) => void;
  removeRecord: (studentId: number) => void;
  syncFromServer: (records: ArchiveRecord[], syncTime?: string) => void;
  syncToServer: () => Promise<void>;
  fetchFromServer: () => Promise<void>;
}

export const useArchiveStore = create<ArchiveState>()(
  persist(
    (set) => ({
      records: {},
      lastSyncTimes: {},
      autoSyncEnabled: false,
      setRecord: (studentId, record) => {
        set((state) => {
          const existing = state.records[studentId] || {
            studentId,
            level: 1,
            currentStars: 1,
            skillLevels: { ex: 1, normal: 1, passive: 1, sub: 1 },
            equipment: { slot1: null, slot2: null, slot3: null, slot4: null },
            uniqueWeapon: null,
            stats: {},
            capturedAt: new Date().toISOString()
          };
          
          return {
            records: {
              ...state.records,
              [studentId]: { ...existing, ...record, capturedAt: new Date().toISOString() }
            }
          };
        });

        // 자동 동기화 기능 (필요시 활성화)
        const state = useArchiveStore.getState();
        if (state.autoSyncEnabled && typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
          state.syncToServer().catch(console.error);
        }
      },
      removeRecord: (studentId) => set((state) => {
        const newRecords = { ...state.records };
        delete newRecords[studentId];
        return { records: newRecords };
      }),
      syncFromServer: (records, syncTime) => set((state) => {
        const newMap = { ...state.records };
        records.forEach(r => newMap[r.studentId] = r);
        const user = useAuthStore.getState().user;
        const newSyncTimes = { ...(state.lastSyncTimes || {}) };
        if (user?.uid && syncTime) {
          newSyncTimes[user.uid.toString()] = syncTime;
        }
        return { records: newMap, lastSyncTimes: newSyncTimes };
      }),
      syncToServer: async () => {
        const { records } = useArchiveStore.getState();
        // 전체 데이터를 그대로 배열로 전송 (starGrade는 호환성을 위해 유지)
        const recordsArr = Object.values(records).map((r: any) => ({
          ...r,
          starGrade: r.currentStars,
          isOwned: true
        }));
        
        if (recordsArr.length === 0) return;
        
        try {
          const res = await syncCollectionToServer(recordsArr);
          if (res.status === 'success') {
            const user = useAuthStore.getState().user;
            if (user?.uid) {
              set((state) => ({
                lastSyncTimes: {
                  ...(state.lastSyncTimes || {}),
                  [user.uid.toString()]: res.lastSyncTime
                }
              }));
            }
          }
        } catch (error) {
          console.error('컬렉션 동기화 실패:', error);
          throw error;
        }
      },
      fetchFromServer: async () => {
        try {
          const res = await fetchCollectionFromServer();
          if (res.status === 'success') {
            const mappedRecords: ArchiveRecord[] = res.collections.map((c: any) => {
              // 서버에 저장된 details가 있다면 그대로 복원하고, 없다면 기본값 세팅
              if (c.details) {
                return {
                  ...c.details,
                  studentId: c.studentId,
                  currentStars: c.starGrade
                };
              }

              return {
                studentId: c.studentId,
                currentStars: c.starGrade,
                level: 1,
                skillLevels: { ex: 1, normal: 1, passive: 1, sub: 1 },
                equipment: { slot1: null, slot2: null, slot3: null, slot4: null },
                uniqueWeapon: null,
                stats: {},
                capturedAt: new Date().toISOString()
              };
            });
            useArchiveStore.getState().syncFromServer(mappedRecords, res.lastSyncTime);
          }
        } catch (error) {
          console.error('서버에서 컬렉션 불러오기 실패:', error);
          throw error;
        }
      }
    }),
    {
      name: 'ba-personal-archive', // localStorage key
    }
  )
);
