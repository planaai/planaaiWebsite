export const EQUIP_MAX_LEVEL: Record<number, number> = {
  1: 10,
  2: 20,
  3: 30,
  4: 40,
  5: 45,
  6: 50,
  7: 55,
  8: 60,
  9: 65,
  10: 70
};

export function getEquipMaxLevel(tier: number): number {
  return EQUIP_MAX_LEVEL[tier] ?? 1;
}

export function getWeaponMaxLevel(star: number): number {
  return star > 0 ? star * 10 + 20 : 1;
}

export const SKILL_MAX = {
  ex: 5,
  normal: 10,
  passive: 10,
  sub: 10
} as const;
