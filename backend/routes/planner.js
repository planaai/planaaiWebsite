const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { getLevelData, getHtmlData, getAbilityData } = require('../utils/growthData');
const { optionalAuth, requireAuth } = require('../middleware/auth');

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

router.get('/', optionalAuth, async (req, res) => {
    try {
        if (!req.user) return res.json([]);
        const plans = await prisma.growthPlan.findMany({
            where: { userId: req.user.id },
            include: { student: true }
        });
        res.json(plans);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch plans', details: err.message, stack: err.stack });
    }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const { studentId } = req.body;
        const existing = await prisma.growthPlan.findFirst({
            where: { userId: req.user.id, studentId: Number(studentId) }
        });
        if (existing) return res.status(400).json({ error: 'Plan already exists' });

        const plan = await prisma.growthPlan.create({
            data: { userId: req.user.id, studentId: Number(studentId) }
        });
        res.json(plan);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create plan' });
    }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const plan = await prisma.growthPlan.findUnique({ where: { id: Number(id) } });
        if (!plan || plan.userId !== req.user.id) return res.status(404).json({ error: 'Plan not found' });

        const updated = await prisma.growthPlan.update({
            where: { id: Number(id) },
            data: {
                currentStar: updates.currentStar, targetStar: updates.targetStar,
                currentLevel: updates.currentLevel, targetLevel: updates.targetLevel,
                currentEx: updates.currentEx, targetEx: updates.targetEx,
                currentBasic: updates.currentBasic, targetBasic: updates.targetBasic,
                currentEnh: updates.currentEnh, targetEnh: updates.targetEnh,
                currentSub: updates.currentSub, targetSub: updates.targetSub,
                currentEquip1: updates.currentEquip1, targetEquip1: updates.targetEquip1,
                currentEquip2: updates.currentEquip2, targetEquip2: updates.targetEquip2,
                currentEquip3: updates.currentEquip3, targetEquip3: updates.targetEquip3,
                currentWeaponStar: updates.currentWeaponStar, targetWeaponStar: updates.targetWeaponStar,
                currentWeaponLevel: updates.currentWeaponLevel, targetWeaponLevel: updates.targetWeaponLevel,
                currentAbility: updates.currentAbility, targetAbility: updates.targetAbility
            }
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update plan' });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await prisma.growthPlan.findUnique({ where: { id: Number(id) } });
        if (!plan || plan.userId !== req.user.id) return res.status(404).json({ error: 'Plan not found' });
        await prisma.growthPlan.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete plan' });
    }
});

router.get('/calculate/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await prisma.growthPlan.findUnique({ 
            where: { id: Number(id) },
            include: { student: true }
        });
        if (!plan || plan.userId !== req.user.id) return res.status(404).json({ error: 'Plan not found' });

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
            wbs: 0,
            bds: {},
            techNotes: {},
            secret: 0
        };

        // 1. Level EXP
        let totalExpNeeded = 0;
        for (let l = plan.currentLevel + 1; l <= plan.targetLevel; l++) {
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

        const schemaPath = require('path').join(__dirname, '../data/schemaConfig.json');
        let schemaConfig = { equipments: [] };
        try {
            if (require('fs').existsSync(schemaPath)) {
                schemaConfig = JSON.parse(require('fs').readFileSync(schemaPath, 'utf8'));
            }
        } catch(e) {}

        // 2. Equipment Tier
        const calcEquip = (currT, targetT, equipType) => {
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
        calcEquip(plan.currentEquip1, plan.targetEquip1, plan.student?.equipmentSlot1);
        calcEquip(plan.currentEquip2, plan.targetEquip2, plan.student?.equipmentSlot2);
        calcEquip(plan.currentEquip3, plan.targetEquip3, plan.student?.equipmentSlot3);

        // 3. Weapon & Character Star
        const STAR_COSTS = {
            2: { eleph: 30, credit: 40000 },
            3: { eleph: 80, credit: 200000 },
            4: { eleph: 100, credit: 1000000 },
            5: { eleph: 120, credit: 2000000 }
        };
        for (let s = (plan.currentStar || 3) + 1; s <= (plan.targetStar || 5); s++) {
            const cost = STAR_COSTS[s];
            if (cost) { required.elephs += cost.eleph; required.credits += cost.credit; }
        }

        for (let s = plan.currentWeaponStar + 1; s <= plan.targetWeaponStar; s++) {
            const starData = htmlData.weaponStar[s];
            if (starData) { required.elephs += starData.eleph; required.credits += starData.credit; }
        }
        for (let l = plan.currentWeaponLevel + 1; l <= plan.targetWeaponLevel; l++) {
            const expData = htmlData.weaponExp[l];
            if (expData) { required.weaponExp += expData.exp; required.credits += expData.credit; }
        }
        if (required.weaponExp > 0) {
            let itemName = '온전한 공이'; // Default
            if (['SG', 'SMG', 'HG'].includes(plan.weaponType)) itemName = '온전한 스프링';
            else if (['AR', 'GL', 'RL'].includes(plan.weaponType)) itemName = '온전한 해머';
            else if (['SR', 'RG', 'MT', 'MG'].includes(plan.weaponType)) itemName = '온전한 총열';
            
            // FT (Megu) is a special case
            if (plan.weaponType === 'FT') itemName = '온전한 공이';
            
            required.weaponItems[itemName] = Math.ceil(required.weaponExp / 75);
        }

        // 4. Ability Liberation
        for (let l = plan.currentAbility + 1; l <= plan.targetAbility; l++) {
            const abData = getAbility(l);
            if (abData.oopartCount > 0) {
                const oKey = abData.oopartTier + ' 오파츠 (메인)';
                required.ooparts[oKey] = (required.ooparts[oKey] || 0) + abData.oopartCount;
            }
            if (abData.wbCount > 0) required.wbs += abData.wbCount;
        }

        // 5. Skills
        const addOopart = (m, isMain) => {
            const suffix = isMain ? ' 오파츠 (메인)' : ' 오파츠 (서브)';
            const tName = getTierPrefix(m.tier) + suffix;
            required.ooparts[tName] = (required.ooparts[tName] || 0) + m.amount;
        };

        // EX Skill
        for (let lv = plan.currentEx; lv < plan.targetEx; lv++) {
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
            { c: plan.currentBasic, t: plan.targetBasic },
            { c: plan.currentEnh, t: plan.targetEnh },
            { c: plan.currentSub, t: plan.targetSub }
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

        res.json({ plan, required });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to calculate' });
    }
});

router.post('/calculate/dynamic', async (req, res) => {
    try {
        const { plan } = req.body;
        if (!plan) return res.status(400).json({ error: 'Plan data required' });

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
        for (let l = plan.currentLevel + 1; l <= plan.targetLevel; l++) {
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

        const schemaPath = require('path').join(__dirname, '../data/schemaConfig.json');
        let schemaConfig = { equipments: [] };
        try {
            if (require('fs').existsSync(schemaPath)) {
                schemaConfig = JSON.parse(require('fs').readFileSync(schemaPath, 'utf8'));
            }
        } catch(e) {}

        // 2. Equipment Tier
        const calcEquip = (currT, targetT, equipType) => {
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
        calcEquip(plan.currentEquip1, plan.targetEquip1, plan.equip1Type);
        calcEquip(plan.currentEquip2, plan.targetEquip2, plan.equip2Type);
        calcEquip(plan.currentEquip3, plan.targetEquip3, plan.equip3Type);

        // 3. Weapon & Character Star
        const STAR_COSTS = {
            2: { eleph: 30, credit: 40000 },
            3: { eleph: 80, credit: 200000 },
            4: { eleph: 100, credit: 1000000 },
            5: { eleph: 120, credit: 2000000 }
        };
        for (let s = (plan.currentStar || 3) + 1; s <= (plan.targetStar || 5); s++) {
            const cost = STAR_COSTS[s];
            if (cost) { required.elephs += cost.eleph; required.credits += cost.credit; }
        }

        for (let s = plan.currentWeaponStar + 1; s <= plan.targetWeaponStar; s++) {
            const starData = htmlData.weaponStar[s];
            if (starData) { required.elephs += starData.eleph; required.credits += starData.credit; }
        }
        for (let l = plan.currentWeaponLevel + 1; l <= plan.targetWeaponLevel; l++) {
            const expData = htmlData.weaponExp[l];
            if (expData) { required.weaponExp += expData.exp; required.credits += expData.credit; }
        }
        if (required.weaponExp > 0) {
            let itemName = '온전한 공이'; // Default
            if (['SG', 'SMG', 'HG'].includes(plan.weaponType)) itemName = '온전한 스프링';
            else if (['AR', 'GL', 'RL'].includes(plan.weaponType)) itemName = '온전한 해머';
            else if (['SR', 'RG', 'MT', 'MG'].includes(plan.weaponType)) itemName = '온전한 총열';
            
            // FT (Megu) is a special case
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
        for (let lv = plan.currentEx; lv < plan.targetEx; lv++) {
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
            { c: plan.currentBasic, t: plan.targetBasic },
            { c: plan.currentEnh, t: plan.targetEnh },
            { c: plan.currentSub, t: plan.targetSub }
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

        res.json({ plan, required });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to calculate dynamic' });
    }
});

const { getDropData } = require('../utils/dropData');

router.get('/equipment-drops', async (req, res) => {
    try {
        const dropData = getDropData();
        res.json(dropData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get equipment drops' });
    }
});

module.exports = router;
