import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ArchiveRecord } from '../types';

export interface PlannerRecord {
  id: number;
  studentId: number;
  currentStar: number;
  targetStar: number;
  currentLevel: number;
  targetLevel: number;
  currentEx: number;
  targetEx: number;
  currentBasic: number;
  targetBasic: number;
  currentEnh: number;
  targetEnh: number;
  currentSub: number;
  targetSub: number;
  currentEquip1: number;
  targetEquip1: number;
  currentEquip2: number;
  targetEquip2: number;
  currentEquip3: number;
  targetEquip3: number;
  currentWeaponStar: number;
  targetWeaponStar: number;
  currentWeaponLevel: number;
  targetWeaponLevel: number;
  currentAbilityHP: number;
  targetAbilityHP: number;
  currentAbilityAtk: number;
  targetAbilityAtk: number;
  currentAbilityHeal: number;
  targetAbilityHeal: number;
}

interface PlannerState {
  plans: PlannerRecord[];
  addPlan: (studentId: number, archiveData?: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => void;
  updatePlan: (id: number, updates: Partial<PlannerRecord>) => void;
  deletePlan: (id: number) => void;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set) => ({
      plans: [],
      addPlan: (studentId, archiveData) => {
        set((state) => {
          if (state.plans.some(p => p.studentId === studentId)) return state;
          
          const getVal = (val: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, fallback: number) => typeof val === 'number' && !isNaN(val) ? val : fallback;
          const getLvl = (val: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => getVal(val, 1);
          
          const newPlan: PlannerRecord = {
            id: Date.now(),
            studentId,
            currentStar: archiveData?.currentStars || 3, targetStar: 5,
            currentLevel: archiveData?.level || 1, targetLevel: 90,
            currentEx: getLvl(archiveData?.skillLevels?.ex), targetEx: 5,
            currentBasic: getLvl(archiveData?.skillLevels?.normal), targetBasic: 10,
            currentEnh: getLvl(archiveData?.skillLevels?.passive), targetEnh: 10,
            currentSub: getLvl(archiveData?.skillLevels?.sub), targetSub: 10,
            currentEquip1: getLvl(archiveData?.equipment?.slot1?.tier), targetEquip1: 10,
            currentEquip2: getLvl(archiveData?.equipment?.slot2?.tier), targetEquip2: 10,
            currentEquip3: getLvl(archiveData?.equipment?.slot3?.tier), targetEquip3: 10,
            currentWeaponStar: archiveData?.uniqueWeapon?.starGrade || 0, targetWeaponStar: 3,
            currentWeaponLevel: archiveData?.uniqueWeapon?.level || 1, targetWeaponLevel: 60,
            currentAbilityHP: getVal(archiveData?.potentialLevels?.maxHP, 0), targetAbilityHP: 25,
            currentAbilityAtk: getVal(archiveData?.potentialLevels?.attackPower, 0), targetAbilityAtk: 25,
            currentAbilityHeal: getVal(archiveData?.potentialLevels?.healPower, 0), targetAbilityHeal: 25
          };
          return { plans: [...state.plans, newPlan] };
        });
      },
      updatePlan: (id, updates) => {
        set((state) => ({
          plans: state.plans.map(p => p.id === id ? { ...p, ...updates } : p)
        }));
      },
      deletePlan: (id) => {
        set((state) => ({
          plans: state.plans.filter(p => p.id !== id)
        }));
      }
    }),
    {
      name: 'ba-planner-archive',
    }
  )
);
