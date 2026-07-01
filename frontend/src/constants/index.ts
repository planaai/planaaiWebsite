export const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const EX_COSTS: Record<number, any> = {
  2: { bd: { tier: 0, amount: 12 }, oopart1: { tier: 0, amount: 13 }, credit: 80000 },
  3: { bd: { tier: 0, amount: 12 }, bd2: { tier: 1, amount: 18 }, oopart1: { tier: 1, amount: 15 }, oopart2: { tier: 0, amount: 31 }, credit: 500000 },
  4: { bd: { tier: 2, amount: 12 }, bd2: { tier: 1, amount: 18 }, oopart1: { tier: 2, amount: 9 }, oopart2: { tier: 1, amount: 25 }, credit: 3000000 },
  5: { bd: { tier: 3, amount: 8 }, bd2: { tier: 2, amount: 18 }, oopart1: { tier: 3, amount: 10 }, oopart2: { tier: 2, amount: 19 }, credit: 10000000 }
};

export const NORMAL_COSTS: Record<number, any> = {
  2: { note: { tier: 0, amount: 5 }, credit: 5000 },
  3: { note: { tier: 0, amount: 8 }, credit: 7500 },
  4: { note: { tier: 0, amount: 5 }, note2: { tier: 1, amount: 12 }, oopart1: { tier: 0, amount: 5 }, credit: 60000 },
  5: { note: { tier: 0, amount: 8 }, oopart1: { tier: 1, amount: 5 }, oopart2: { tier: 0, amount: 13 }, credit: 90000 },
  6: { note: { tier: 2, amount: 5 }, note2: { tier: 1, amount: 12 }, oopart1: { tier: 1, amount: 10 }, oopart2: { tier: 0, amount: 18 }, credit: 300000 },
  7: { note: { tier: 2, amount: 8 }, oopart1: { tier: 2, amount: 4 }, oopart2: { tier: 1, amount: 17 }, credit: 450000 },
  8: { note: { tier: 3, amount: 8 }, note2: { tier: 2, amount: 12 }, oopart1: { tier: 3, amount: 4 }, oopart2: { tier: 2, amount: 9 }, credit: 1500000 },
  9: { note: { tier: 3, amount: 12 }, oopart1: { tier: 3, amount: 8 }, oopart2: { tier: 3, amount: 14 }, credit: 2400000 },
  10: { secret: 1, credit: 4000000 }
};

export const TIER_COLORS = ['text-slate-400', 'text-blue-400', 'text-amber-400', 'text-purple-400'];
export const TIER_BG = ['bg-slate-700/50', 'bg-blue-900/30', 'bg-amber-900/30', 'bg-purple-900/30'];
export const TIER_BORDER = ['border-slate-600', 'border-blue-700/50', 'border-amber-700/50', 'border-purple-700/50'];
export const PREFIX = ['기초', '일반', '고급', '최상급'];

export const BULLET_COLORS: Record<string, string> = { Explosion: 'text-red-400', Pierce: 'text-amber-400', Mystic: 'text-blue-400', Vibration: 'text-purple-400', Decomposition: 'text-emerald-400' };
export const ARMOR_COLORS: Record<string, string> = { LightArmor: 'text-red-400', HeavyArmor: 'text-amber-400', MysticArmor: 'text-blue-400', ElasticArmor: 'text-purple-400', CompositeArmor: 'text-emerald-400' };
