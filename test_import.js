const req = {
  body: {
    studentName: '유우카',
    currentLevel: 90,
    currentStar: 5,
    skills: { ex: '3', basic: '5', enh: '3', sub: '3' },
    equipment: {
      slot1: { tier: 8, level: 60 },
      slot2: { tier: 8, level: 60 },
      slot3: { tier: 8, level: 60 },
      slot4: { tier: 1 }
    },
    weapon: { level: 30, star: 2 },
    stats: {
      maxHP: 13955,
      hpAbility: 17,
      attackPower: 2290,
      atkAbility: null,
      defensePower: 664,
      healPower: 6335,
      healAbility: null
    }
  }
};

let detailsObj = {};
const { currentLevel, skills, equipment, weapon, stats } = req.body;

detailsObj.level = currentLevel || 1;
if (skills) {
  detailsObj.skillLevels = {
    ex: parseInt(skills.ex) || 1,
    normal: parseInt(skills.basic) || 1,
    passive: parseInt(skills.enh) || 1,
    sub: parseInt(skills.sub) || 1
  };
}
if (equipment) {
  detailsObj.equipment = {
    slot1: equipment.slot1 ? { tier: equipment.slot1.tier, level: equipment.slot1.level } : null,
    slot2: equipment.slot2 ? { tier: equipment.slot2.tier, level: equipment.slot2.level } : null,
    slot3: equipment.slot3 ? { tier: equipment.slot3.tier, level: equipment.slot3.level } : null,
    slot4: equipment.slot4 ? { tier: equipment.slot4.tier, level: 1 } : null
  };
}
if (stats) {
  detailsObj.stats = {
    maxHP: stats.maxHP,
    attackPower: stats.attackPower,
    defensePower: stats.defensePower,
    healPower: stats.healPower
  };
}
if (stats?.hpAbility !== undefined || stats?.atkAbility !== undefined || stats?.healAbility !== undefined) {
  if (!detailsObj.potentialLevels) detailsObj.potentialLevels = {};
  if (stats?.hpAbility !== undefined) detailsObj.potentialLevels.maxHP = stats.hpAbility;
  if (stats?.atkAbility !== undefined) detailsObj.potentialLevels.attackPower = stats.atkAbility;
  if (stats?.healAbility !== undefined) detailsObj.potentialLevels.healPower = stats.healAbility;
}

console.log(JSON.stringify(detailsObj, null, 2));
