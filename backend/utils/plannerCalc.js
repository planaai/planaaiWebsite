const path = require('path');
const fs = require('fs');
const { getLevelData, getHtmlData, getAbilityData } = require('./growthData');
const { EX_SKILL_COSTS, NORMAL_SKILL_COSTS, getTierPrefix } = require('../constants/skillCosts');

const STAR_COSTS = {
  2: { eleph: 30, credit: 40000 },
  3: { eleph: 80, credit: 200000 },
  4: { eleph: 100, credit: 1000000 },
  5: { eleph: 120, credit: 2000000 }
};

function calculateRequiredResources(plan) {
  const levelData = getLevelData();
  const htmlData = getHtmlData();
  const getAbility = getAbilityData();

  const required = {
    credits: 0,
    expReports: { '초급 활동 보고서': 0, '일반 활동 보고서': 0, '상급 활동 보고서': 0, '최상급 활동 보고서': 0 },
    blueprints: {},
    elephs: 0,
    weaponExp: 0,
    weaponItems: {},
    ooparts: {},
    wbs: {},
    bds: {},
    techNotes: {},
    secret: 0
  };

  // 1. Level EXP
  let totalExpNeeded = 0;
  for (let l = (plan.currentLevel || 1) + 1; l <= (plan.targetLevel || 1); l++) {
    if (levelData.expTable[l]) totalExpNeeded += levelData.expTable[l];
  }
  if (totalExpNeeded > 0) {
    let expRemaining = totalExpNeeded;
    const reports = levelData.reports;
    const useReport = (nameKey, targetKey) => {
      if (reports[nameKey]) {
        const count = Math.floor(expRemaining / reports[nameKey].exp);
        required.expReports[targetKey] += count;
        required.credits += count * reports[nameKey].credit;
        expRemaining %= reports[nameKey].exp;
      }
    };
    useReport('최상급 보고서', '최상급 활동 보고서');
    useReport('상급 보고서', '상급 활동 보고서');
    useReport('일반 보고서', '일반 활동 보고서');
    if (reports['기초 보고서'] && expRemaining > 0) {
      const count = Math.ceil(expRemaining / reports['기초 보고서'].exp);
      required.expReports['초급 활동 보고서'] += count;
      required.credits += count * reports['기초 보고서'].credit;
    }
  }

  // 2. Equipment Tier
  const schemaPath = path.join(__dirname, '../data/schemaConfig.json');
  let schemaConfig = { equipments: [] };
  try {
    if (fs.existsSync(schemaPath)) {
      schemaConfig = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    }
  } catch (e) {}

  const calcEquip = (currT, targetT, equipType) => {
    if (!currT || !targetT || !equipType) return;
    const equipData = schemaConfig.equipments.find(e => e.key === equipType);
    const equipLabel = equipData ? equipData.label : equipType;

    for (let t = currT + 1; t <= targetT; t++) {
      const tierData = htmlData.equipTier[t];
      if (tierData) {
        required.credits += tierData.credit;
        for (const [bp, amount] of Object.entries(tierData.blueprints)) {
          const tierNum = parseInt(bp.replace('T', ''));
          let equipName = `T${tierNum} ${equipLabel}`;
          let iconUrl = '';
          if (equipData && equipData.tiers && equipData.tiers[tierNum - 1]) {
            const tData = equipData.tiers[tierNum - 1];
            iconUrl = tData.blueprintIconUrl || tData.iconUrl || '';
            if (tData.name) {
              equipName = tData.name;
            }
          }
          const blueprintName = `${equipName} 설계도면`;

          if (!required.blueprints[blueprintName]) {
            required.blueprints[blueprintName] = { amount: 0, iconUrl, tier: tierNum, type: equipType };
          }
          required.blueprints[blueprintName].amount += amount;
        }
      }
    }
  };

  const slot1 = plan.student?.equipmentSlot1 || plan.equipmentSlot1;
  const slot2 = plan.student?.equipmentSlot2 || plan.equipmentSlot2;
  const slot3 = plan.student?.equipmentSlot3 || plan.equipmentSlot3;

  calcEquip(plan.currentEquip1, plan.targetEquip1, slot1);
  calcEquip(plan.currentEquip2, plan.targetEquip2, slot2);
  calcEquip(plan.currentEquip3, plan.targetEquip3, slot3);

  // 3. Weapon & Character Star
  for (let s = (plan.currentStar || 3) + 1; s <= (plan.targetStar || 5); s++) {
    const cost = STAR_COSTS[s];
    if (cost) { required.elephs += cost.eleph; required.credits += cost.credit; }
  }

  for (let s = (plan.currentWeaponStar || 0) + 1; s <= (plan.targetWeaponStar || 0); s++) {
    const starData = htmlData.weaponStar[s];
    if (starData) { required.elephs += starData.eleph; required.credits += starData.credit; }
  }

  for (let l = (plan.currentWeaponLevel || 0) + 1; l <= (plan.targetWeaponLevel || 0); l++) {
    const expData = htmlData.weaponExp[l];
    if (expData) { required.weaponExp += expData.exp; required.credits += expData.credit; }
  }

  if (required.weaponExp > 0) {
    let itemName = '온전한 공이';
    if (['SG', 'SMG', 'HG'].includes(plan.weaponType)) itemName = '온전한 스프링';
    else if (['AR', 'GL', 'RL'].includes(plan.weaponType)) itemName = '온전한 해머';
    else if (['SR', 'RG', 'MT', 'MG'].includes(plan.weaponType)) itemName = '온전한 총열';
    if (plan.weaponType === 'FT') itemName = '온전한 공이';
    required.weaponItems[itemName] = Math.ceil(required.weaponExp / 75);
  }

  // 4. Ability Liberation
  const calcAbility = (curr, target, wbName) => {
    if (curr === undefined || target === undefined) return;
    for (let l = curr + 1; l <= target; l++) {
      const abData = getAbility(l);
      if (abData.oopartCount > 0) {
        const oKey = abData.oopartTier + ' 오파츠 (메인)';
        required.ooparts[oKey] = (required.ooparts[oKey] || 0) + abData.oopartCount;
      }
      if (abData.wbCount > 0) {
        required.wbs[wbName] = (required.wbs[wbName] || 0) + abData.wbCount;
      }
    }
  };

  if (plan.currentAbilityHP !== undefined) {
    calcAbility(plan.currentAbilityHP, plan.targetAbilityHP, '교양 체육 WB');
    calcAbility(plan.currentAbilityAtk, plan.targetAbilityAtk, '교양 사격 WB');
    calcAbility(plan.currentAbilityHeal, plan.targetAbilityHeal, '교양 위생 WB');
  } else if (plan.currentAbility !== undefined) {
    calcAbility(plan.currentAbility, plan.targetAbility, 'WB');
  }

  // 5. Skills
  const addOopart = (m, isMain) => {
    const suffix = isMain ? ' 오파츠 (메인)' : ' 오파츠 (서브)';
    const tName = getTierPrefix(m.tier) + suffix;
    required.ooparts[tName] = (required.ooparts[tName] || 0) + m.amount;
  };

  // EX Skill
  for (let lv = (plan.currentEx || 1); lv < (plan.targetEx || 1); lv++) {
    const cost = EX_SKILL_COSTS[lv];
    if (!cost) continue;
    required.credits += cost.credit;
    if (cost.bd) cost.bd.forEach(m => {
      const n = getTierPrefix(m.tier) + ' 전술 교육 BD';
      required.bds[n] = (required.bds[n] || 0) + m.amount;
    });
    if (cost.primary) cost.primary.forEach(m => addOopart(m, true));
    if (cost.secondary) cost.secondary.forEach(m => addOopart(m, false));
  }

  // Normal, Passive, Sub
  const otherSkills = [
    { c: plan.currentBasic || 1, t: plan.targetBasic || 1 },
    { c: plan.currentEnh || 1, t: plan.targetEnh || 1 },
    { c: plan.currentSub || 1, t: plan.targetSub || 1 }
  ];

  otherSkills.forEach(skill => {
    for (let lv = skill.c; lv < skill.t; lv++) {
      const cost = NORMAL_SKILL_COSTS[lv];
      if (!cost) continue;
      required.credits += cost.credit;
      if (cost.tn) cost.tn.forEach(m => {
        const n = getTierPrefix(m.tier) + ' 기술 노트';
        required.techNotes[n] = (required.techNotes[n] || 0) + m.amount;
      });
      if (cost.primary) cost.primary.forEach(m => addOopart(m, true));
      if (cost.secondary) cost.secondary.forEach(m => addOopart(m, false));
      if (cost.secret) required.secret += cost.secret;
    }
  });

  return required;
}

module.exports = {
  calculateRequiredResources
};
