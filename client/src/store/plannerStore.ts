import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ArchiveRecord } from '../types';
import { getEquipMaxLevel, getWeaponMaxLevel } from '../lib/equipmentUtils';

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
  currentEquip1Level?: number;
  targetEquip1: number;
  targetEquip1Level?: number;
  currentEquip2: number;
  currentEquip2Level?: number;
  targetEquip2: number;
  targetEquip2Level?: number;
  currentEquip3: number;
  currentEquip3Level?: number;
  targetEquip3: number;
  targetEquip3Level?: number;
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
  addPlan: (studentId: number, archiveData?: Partial<ArchiveRecord>) => void;
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

          const getVal = (val: number | undefined | null, fallback: number) => typeof val === 'number' && !isNaN(val) ? val : fallback;
          const getLvl = (val: number | undefined | null) => getVal(val, 1);

          const currentEquip1 = archiveData?.equipment?.slot1 ? getLvl(archiveData.equipment.slot1.tier) : 0;
          const currentEquip2 = archiveData?.equipment?.slot2 ? getLvl(archiveData.equipment.slot2.tier) : 0;
          const currentEquip3 = archiveData?.equipment?.slot3 ? getLvl(archiveData.equipment.slot3.tier) : 0;

          const currentWeaponStar = archiveData?.uniqueWeapon ? getVal(archiveData.uniqueWeapon.stars, 0) : 0;
          const currentWeaponLevel = archiveData?.uniqueWeapon ? getVal(archiveData.uniqueWeapon.level, 1) : 1;
          const targetWeaponStar = Math.max(3, currentWeaponStar);
          const targetWeaponLevel = Math.max(getWeaponMaxLevel(targetWeaponStar), currentWeaponLevel);

          const newPlan: PlannerRecord = {
            id: Date.now(),
            studentId,
            currentStar: archiveData?.currentStars || 3, targetStar: 5,
            currentLevel: archiveData?.level || 1, targetLevel: 90,
            currentEx: getLvl(archiveData?.skillLevels?.ex), targetEx: 5,
            currentBasic: getLvl(archiveData?.skillLevels?.normal), targetBasic: 10,
            currentEnh: getLvl(archiveData?.skillLevels?.passive), targetEnh: 10,
            currentSub: getLvl(archiveData?.skillLevels?.sub), targetSub: 10,
            currentEquip1, currentEquip1Level: archiveData?.equipment?.slot1 ? getLvl(archiveData.equipment.slot1.level) : 1,
            targetEquip1: 10, targetEquip1Level: 70,
            currentEquip2, currentEquip2Level: archiveData?.equipment?.slot2 ? getLvl(archiveData.equipment.slot2.level) : 1,
            targetEquip2: 10, targetEquip2Level: 70,
            currentEquip3, currentEquip3Level: archiveData?.equipment?.slot3 ? getLvl(archiveData.equipment.slot3.level) : 1,
            targetEquip3: 10, targetEquip3Level: 70,
            currentWeaponStar, targetWeaponStar,
            currentWeaponLevel, targetWeaponLevel,
            currentAbilityHP: getVal(archiveData?.potentialLevels?.maxHP, 0), targetAbilityHP: 25,
            currentAbilityAtk: getVal(archiveData?.potentialLevels?.attackPower, 0), targetAbilityAtk: 25,
            currentAbilityHeal: getVal(archiveData?.potentialLevels?.healPower, 0), targetAbilityHeal: 25
          };
          return { plans: [...state.plans, newPlan] };
        });
      },
      updatePlan: (id, updates) => {
        set((state) => ({
          plans: state.plans.map(p => {
            if (p.id !== id) return p;
            const merged = { ...p, ...updates };
            const maxWLevel = getWeaponMaxLevel(merged.targetWeaponStar);
            if (merged.targetWeaponLevel > maxWLevel) {
              merged.targetWeaponLevel = maxWLevel;
            }
            return merged;
          })
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
