const express = require('express');
const { prisma } = require('../db');
const { optionalAuth } = require('../middleware/auth');

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const router = express.Router();

// POST /api/import/screenshot
// 파이썬 스크린샷 추출기에서 전송한 JSON 데이터를 받아 DB(Collection, GrowthPlan) 갱신
router.post('/screenshot', optionalAuth, async (req, res) => {
  try {
    const {
      studentName,
      currentLevel,
      currentStar,
      skills,
      equipment,
      weapon,
      stats // 세부 능력치 추가 (maxHP, attackPower, defensePower, healPower)
    } = req.body;

    if (!studentName) {
      return res.status(400).json({ error: 'studentName is required' });
    }

    // 학생 이름으로 매핑 (정확한 이름 매칭 시도)
    let student = await prisma.student.findFirst({
      where: { name: studentName }
    });

    if (!student) {
      // 괄호 등 특수문자 문제 고려하여 포함 여부로 검색
      student = await prisma.student.findFirst({
        where: { name: { contains: studentName } }
      });
    }

    if (!student) {
      // Levenshtein 거리로 유사도 검사 (오타 보정)
      const allStudents = await prisma.student.findMany({ select: { id: true, name: true } });
      let bestMatch = null;
      let bestDist = Infinity;
      const cleanA = studentName.replace(/[^가-힣a-zA-Z0-9]/g, '');
      
      for (const s of allStudents) {
         const cleanB = s.name.replace(/[^가-힣a-zA-Z0-9]/g, '');
         const dist = levenshtein(cleanA, cleanB);
         if (dist < bestDist) {
            bestDist = dist;
            bestMatch = s;
         }
      }
      if (bestMatch && bestDist <= 2) { // Allow up to 2 typos
         student = await prisma.student.findUnique({ where: { id: bestMatch.id } });
      }
    }

    if (!student) {
      return res.status(404).json({ error: `Student not found: ${studentName}` });
    }

    // 기본적으로 로그인한 유저, 없으면 첫번째 유저를 가져온다 (테스트용)
    let userId = req.user ? req.user.id : null;
    if (!userId) {
      const firstUser = await prisma.user.findFirst();
      if (!firstUser) {
         return res.status(500).json({ error: 'No user exists to map data to' });
      }
      userId = firstUser.id;
    }

    // 1. Collection (보유 여부 및 성급) 업데이트
    const existingCollection = await prisma.collection.findUnique({
      where: {
        userId_studentId: {
          userId: userId,
          studentId: student.id,
        }
      }
    });

    let detailsObj = existingCollection?.details ? (typeof existingCollection.details === 'string' ? JSON.parse(existingCollection.details) : existingCollection.details) : {};
    
    // bondRank와 장비 레벨 저장
    const extractedBondRank = req.body.bondRank ?? req.body.bond_rank ?? stats?.bondRank ?? stats?.bond_rank;
    if (extractedBondRank !== undefined && extractedBondRank !== null) {
      const parsedBond = parseInt(extractedBondRank);
      if (!isNaN(parsedBond)) detailsObj.bondRank = parsedBond;
    }
    
    if (equipment?.slot1?.level) detailsObj.equip1Level = equipment.slot1.level;
    if (equipment?.slot2?.level) detailsObj.equip2Level = equipment.slot2.level;
    if (equipment?.slot3?.level) detailsObj.equip3Level = equipment.slot3.level;
    if (equipment?.slot4?.tier) detailsObj.equip4Tier = equipment.slot4.tier;
    
    // 능력개방 레벨 저장 (frontend의 potentialLevels 구조에 맞춤)
    if (stats?.hpAbility !== undefined || stats?.atkAbility !== undefined || stats?.healAbility !== undefined) {
      if (!detailsObj.potentialLevels) detailsObj.potentialLevels = {};
      if (stats?.hpAbility !== undefined) detailsObj.potentialLevels.maxHP = stats.hpAbility;
      if (stats?.atkAbility !== undefined) detailsObj.potentialLevels.attackPower = stats.atkAbility;
      if (stats?.healAbility !== undefined) detailsObj.potentialLevels.healPower = stats.healAbility;
    }

    const parseEquip = (val) => {
      if (typeof val === 'string' && val.toUpperCase().startsWith('T')) {
        const num = parseInt(val.toUpperCase().replace('T', ''));
        return isNaN(num) ? 1 : num;
      }
      return parseInt(val) || 1;
    };

    const parseSkill = (val, isEx) => {
      if (val === 'MAX' || val === 'max') return isEx ? 5 : 10;
      if (typeof val === 'string') {
        const match = val.match(/\d+/);
        if (match) return parseInt(match[0]);
      }
      const num = parseInt(val);
      return isNaN(num) ? 1 : num;
    };

    // 기본 레벨
    detailsObj.level = currentLevel || 1;
    
    // 스킬 정보
    if (skills) {
      detailsObj.skillLevels = {
        ex: parseSkill(skills.ex, true),
        normal: parseSkill(skills.basic, false),
        passive: parseSkill(skills.enh, false),
        sub: parseSkill(skills.sub, false)
      };
    }
    
    // 장비 정보 (프론트엔드의 { tier, level } 구조 반영)
    if (equipment) {
      detailsObj.equipment = {
        slot1: equipment.slot1 ? { tier: equipment.slot1.tier || parseEquip(equipment.slot1), level: equipment.slot1.level || 1 } : null,
        slot2: equipment.slot2 ? { tier: equipment.slot2.tier || parseEquip(equipment.slot2), level: equipment.slot2.level || 1 } : null,
        slot3: equipment.slot3 ? { tier: equipment.slot3.tier || parseEquip(equipment.slot3), level: equipment.slot3.level || 1 } : null,
        slot4: equipment.slot4 ? { tier: equipment.slot4.tier || parseEquip(equipment.slot4), level: equipment.slot4.level || 1 } : null,
      };
    }
    
    // 고유무기 정보
    if (weapon) {
      detailsObj.uniqueWeapon = {
        stars: weapon.star || 1,
        level: weapon.level || 1
      };
    }

    // 상세 스탯을 collection details에 저장
    if (stats) {
      detailsObj.stats = {
        maxHP: stats.maxHP,
        attackPower: stats.attackPower,
        defensePower: stats.defensePower,
        healPower: stats.healPower
      };
    }

    await prisma.collection.upsert({
      where: {
        userId_studentId: {
          userId: userId,
          studentId: student.id,
        }
      },
      update: {
        starGrade: currentStar || undefined,
        isOwned: true,
        details: detailsObj,
      },
      create: {
        userId: userId,
        studentId: student.id,
        starGrade: currentStar || 3,
        isOwned: true,
        details: detailsObj,
      }
    });

    // GrowthPlan (육성 상태) 업데이트
    // parseSkill, parseEquip는 위에서 선언됨

    // findFirst() 대신 findMany로 체크
    const existingPlan = await prisma.growthPlan.findFirst({
      where: { userId, studentId: student.id }
    });

    const planData = {
      currentLevel: currentLevel || undefined,
      currentStar: currentStar || undefined,
      currentEx: skills?.ex ? parseSkill(skills.ex, true) : undefined,
      currentBasic: skills?.basic ? parseSkill(skills.basic, false) : undefined,
      currentEnh: skills?.enh ? parseSkill(skills.enh, false) : undefined,
      currentSub: skills?.sub ? parseSkill(skills.sub, false) : undefined,
      currentEquip1: equipment?.slot1?.tier ? parseInt(equipment.slot1.tier) : (equipment?.slot1 ? parseEquip(equipment.slot1) : undefined),
      currentEquip2: equipment?.slot2?.tier ? parseInt(equipment.slot2.tier) : (equipment?.slot2 ? parseEquip(equipment.slot2) : undefined),
      currentEquip3: equipment?.slot3?.tier ? parseInt(equipment.slot3.tier) : (equipment?.slot3 ? parseEquip(equipment.slot3) : undefined),
      currentWeaponLevel: weapon?.level || undefined,
      currentWeaponStar: weapon?.star || undefined,
    };

    if (existingPlan) {
      await prisma.growthPlan.update({
        where: { id: existingPlan.id },
        data: planData
      });
    } else {
      await prisma.growthPlan.create({
        data: {
          userId: userId,
          studentId: student.id,
          currentLevel: planData.currentLevel || 1,
          currentStar: planData.currentStar || 1,
          currentEx: planData.currentEx || 1,
          currentBasic: planData.currentBasic || 1,
          currentEnh: planData.currentEnh || 1,
          currentSub: planData.currentSub || 1,
          currentEquip1: planData.currentEquip1 || 1,
          currentEquip2: planData.currentEquip2 || 1,
          currentEquip3: planData.currentEquip3 || 1,
          currentWeaponLevel: planData.currentWeaponLevel || 1,
          currentWeaponStar: planData.currentWeaponStar || 0,
        }
      });
    }

    // 세부 능력치가 들어왔을 경우 (StudentStats)
    if (stats) {
       await prisma.studentStats.upsert({
         where: { studentId: student.id },
         update: {
           maxHP: stats.maxHP,
           attackPower: stats.attackPower,
           defensePower: stats.defensePower,
           healPower: stats.healPower
         },
         create: {
           studentId: student.id,
           maxHP: stats.maxHP,
           attackPower: stats.attackPower,
           defensePower: stats.defensePower,
           healPower: stats.healPower
         }
       });
    }

    return res.json({ success: true, message: `Updated data for ${student.name}` });
  } catch (error) {
    console.error('Import Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message, stack: error.stack });
  }
});

module.exports = router;
