const EX_SKILL_COSTS = {
  1: { credit: 80000, bd: [{ tier: 1, amount: 12 }], primary: [{ tier: 1, amount: 14 }], secondary: [] },
  2: { credit: 500000, bd: [{ tier: 1, amount: 12 }, { tier: 2, amount: 18 }], primary: [{ tier: 2, amount: 14 }], secondary: [{ tier: 1, amount: 26 }] },
  3: { credit: 3000000, bd: [{ tier: 2, amount: 12 }, { tier: 3, amount: 18 }], primary: [{ tier: 3, amount: 10 }], secondary: [{ tier: 2, amount: 22 }] },
  4: { credit: 10000000, bd: [{ tier: 3, amount: 8 }, { tier: 4, amount: 18 }], primary: [{ tier: 4, amount: 11 }], secondary: [{ tier: 3, amount: 18 }] }
};

const NORMAL_SKILL_COSTS = {
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

const getTierPrefix = (tier) => {
  switch (tier) {
    case 1: return '기초';
    case 2: return '일반';
    case 3: return '상급';
    case 4: return '최상급';
    default: return `T${tier}`;
  }
};

module.exports = {
  EX_SKILL_COSTS,
  NORMAL_SKILL_COSTS,
  getTierPrefix
};
