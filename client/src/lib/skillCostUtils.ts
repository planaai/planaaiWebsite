import { StudentMaster } from '@/types';

export interface CostEntry {
  credit: number;
  bd?: { tier: number; amount: number }[];
  tn?: { tier: number; amount: number }[];
  primary?: { tier: number; amount: number }[];
  secondary?: { tier: number; amount: number }[];
  secret?: number;
}

// EX Skill Cost Table
export const EX_SKILL_COSTS: Record<number, CostEntry> = {
  1: { credit: 80000, bd: [{ tier: 1, amount: 12 }], primary: [{ tier: 1, amount: 14 }], secondary: [] },
  2: { credit: 500000, bd: [{ tier: 1, amount: 12 }, { tier: 2, amount: 18 }], primary: [{ tier: 2, amount: 14 }], secondary: [{ tier: 1, amount: 26 }] },
  3: { credit: 3000000, bd: [{ tier: 2, amount: 12 }, { tier: 3, amount: 18 }], primary: [{ tier: 3, amount: 10 }], secondary: [{ tier: 2, amount: 22 }] },
  4: { credit: 10000000, bd: [{ tier: 3, amount: 8 }, { tier: 4, amount: 18 }], primary: [{ tier: 4, amount: 11 }], secondary: [{ tier: 3, amount: 18 }] }
};

// Normal/Passive/Sub Skill Cost Table
export const NORMAL_SKILL_COSTS: Record<number, CostEntry> = {
  1: { credit: 5000, tn: [{ tier: 1, amount: 5 }], primary: [], secondary: [] },
  2: { credit: 7500, tn: [{ tier: 1, amount: 8 }], primary: [], secondary: [] },
  3: { credit: 60000, tn: [{ tier: 1, amount: 5 }, { tier: 2, amount: 12 }], primary: [{ tier: 1, amount: 6 }], secondary: [] },
  4: { credit: 90000, tn: [{ tier: 2, amount: 8 }], primary: [{ tier: 2, amount: 4 }], secondary: [{ tier: 1, amount: 12 }] },
  5: { credit: 300000, tn: [{ tier: 2, amount: 5 }, { tier: 3, amount: 12 }], primary: [{ tier: 2, amount: 10 }], secondary: [{ tier: 2, amount: 16 }] },
  6: { credit: 450000, tn: [{ tier: 3, amount: 8 }], primary: [{ tier: 3, amount: 4 }], secondary: [{ tier: 2, amount: 15 }] },
  7: { credit: 1500000, tn: [{ tier: 3, amount: 8 }, { tier: 4, amount: 12 }], primary: [{ tier: 3, amount: 4 }], secondary: [{ tier: 3, amount: 7 }] },
  8: { credit: 2400000, tn: [{ tier: 4, amount: 12 }], primary: [{ tier: 4, amount: 8 }], secondary: [{ tier: 3, amount: 13 }] },
  9: { credit: 4000000, tn: [], primary: [], secondary: [], secret: 1 }
};

export interface MaterialAccumulator {
  credit: number;
  bd: Record<number, number>; // tier -> amount
  tn: Record<number, number>; // tier -> amount
  primary: Record<number, number>; // tier -> amount
  secondary: Record<number, number>; // tier -> amount
  secret: number;
}

export function createEmptyMaterialAccumulator(): MaterialAccumulator {
  return { credit: 0, bd: {}, tn: {}, primary: {}, secondary: {}, secret: 0 };
}

export function calculateSkillCosts(
  current: { ex: number; normal: number; passive: number; sub: number },
  target: { ex: number; normal: number; passive: number; sub: number }
): MaterialAccumulator {
  const acc = createEmptyMaterialAccumulator();

  // EX Skill
  for (let lv = current.ex; lv < target.ex; lv++) {
    const cost = EX_SKILL_COSTS[lv as keyof typeof EX_SKILL_COSTS];
    if (!cost) continue;
    acc.credit += cost.credit;
    cost.bd?.forEach(m => acc.bd[m.tier] = (acc.bd[m.tier] || 0) + m.amount);
    cost.primary?.forEach(m => acc.primary[m.tier] = (acc.primary[m.tier] || 0) + m.amount);
    cost.secondary?.forEach(m => acc.secondary[m.tier] = (acc.secondary[m.tier] || 0) + m.amount);
  }

  // Normal, Passive, Sub
  const otherSkills = [
    { c: current.normal, t: target.normal },
    { c: current.passive, t: target.passive },
    { c: current.sub, t: target.sub }
  ];

  otherSkills.forEach(skill => {
    for (let lv = skill.c; lv < skill.t; lv++) {
      const cost = NORMAL_SKILL_COSTS[lv as keyof typeof NORMAL_SKILL_COSTS];
      if (!cost) continue;
      acc.credit += cost.credit;
      if (cost.tn) cost.tn.forEach(m => acc.tn[m.tier] = (acc.tn[m.tier] || 0) + m.amount);
      if (cost.primary) cost.primary.forEach(m => acc.primary[m.tier] = (acc.primary[m.tier] || 0) + m.amount);
      if (cost.secondary) cost.secondary.forEach(m => acc.secondary[m.tier] = (acc.secondary[m.tier] || 0) + m.amount);
      if (cost.secret) acc.secret += cost.secret;
    }
  });

  return acc;
}
