import type { ArchiveRecord, StudentMaster } from '@/types';

export interface OCRResult {
  parsedData: Partial<ArchiveRecord> & { _needsReview?: boolean };
  rawText: string;
  error?: string;
}

export async function processScreenshot(imageFile: File, masterData: StudentMaster[]): Promise<OCRResult> {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch(`https://api.planaai.kro.kr/api/archive/upload-vision`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error);
    }

    const visionData = json.data;
    const parsedData = parseVisionResult(visionData, masterData);

    return {
      parsedData,
      rawText: JSON.stringify(visionData, null, 2),
    };
  } catch (error) {
    console.warn('Vision API Warning:', error);
    return {
      parsedData: {},
      rawText: '',
      error: '이미지 분석 중 오류가 발생했습니다. (API 한도 초과 또는 서버 연결 실패)',
    };
  }
}

function parseVisionResult(visionData: any, masterData: StudentMaster[]): Partial<ArchiveRecord> & { _needsReview?: boolean } {
  const result: Partial<ArchiveRecord> & { _needsReview?: boolean } = {
    skillLevels: { ex: 1, normal: 1, passive: 1, sub: 1 },
    equipment: { slot1: null, slot2: null, slot3: null, slot4: null },
    stats: {},
    potentialLevels: {}
  };

  try {
    // 1. Name & Student ID
    if (visionData?.studentName) {
      const nameWithoutSpaces = visionData.studentName.replace(/\s+/g, '');
      const sortedMaster = [...masterData].sort((a, b) => b.name.length - a.name.length);
      const detectedStudent = sortedMaster.find(m => nameWithoutSpaces.includes(m.name.replace(/\s+/g, '')));
      if (detectedStudent) {
        result.studentId = detectedStudent.id;
      }
    }

    // 2. Level & Affinity
    if (visionData?.currentLevel) {
      const lv = parseInt(visionData.currentLevel);
      if (!isNaN(lv)) result.level = lv;
    }
    if (visionData?.bondRank) {
      const aff = parseInt(visionData.bondRank);
      if (!isNaN(aff)) result.bondRank = aff;
    }

    // 3. Skills
    if (visionData?.skills) {
      const parseSkill = (val: any, isEx: boolean) => {
        if (val === undefined || val === null || val === '') return 1;
        const strVal = String(val).toUpperCase();
        if (strVal.includes('MAX') || strVal.includes('M')) return isEx ? 5 : 10;
        const num = parseInt(strVal.replace(/\D/g, ''));
        return isNaN(num) ? 1 : num;
      };
      result.skillLevels!.ex = parseSkill(visionData.skills.ex, true);
      result.skillLevels!.normal = parseSkill(visionData.skills.basic, false);
      result.skillLevels!.passive = parseSkill(visionData.skills.enh, false);
      result.skillLevels!.sub = parseSkill(visionData.skills.sub, false);
    }

    // 4. Stars & Unique Weapon
    if (visionData?.currentStar !== undefined) {
      const stars = parseInt(visionData.currentStar);
      if (!isNaN(stars) && stars > 0) result.currentStars = stars;
    }
    
    if (visionData?.weapon && visionData.weapon.level) {
      const wStars = parseInt(visionData.weapon.star || 1);
      const wLevel = parseInt(visionData.weapon.level);
      
      result.uniqueWeapon = {
        stars: !isNaN(wStars) && wStars > 0 ? Math.min(wStars, 4) : 1, // Clamp to max 4
        level: !isNaN(wLevel) && wLevel > 0 ? wLevel : 1
      };
    }

    // 5. Equipment
    if (visionData?.equipment) {
      const parseEq = (eq: any, isSlot4: boolean = false) => {
        if (!eq || !eq.tier) return null;
        const t = parseInt(eq.tier);
        if (isNaN(t) || t === 0) return null;
        if (isSlot4) return { tier: t, level: 1 };
        const l = parseInt(eq.level);
        return { tier: t, level: (!isNaN(l) && l > 0) ? l : (t * 10 - 5) };
      };
      
      result.equipment!.slot1 = parseEq(visionData.equipment.slot1);
      result.equipment!.slot2 = parseEq(visionData.equipment.slot2);
      result.equipment!.slot3 = parseEq(visionData.equipment.slot3);
      result.equipment!.slot4 = parseEq(visionData.equipment.slot4, true);
    }

    // 6. Stats & Potential
    if (visionData?.stats) {
      const hp = parseInt(visionData.stats.maxHP);
      if (!isNaN(hp)) result.stats!.maxHP = hp;
      
      const atk = parseInt(visionData.stats.attackPower);
      if (!isNaN(atk)) result.stats!.attackPower = atk;
      
      const def = parseInt(visionData.stats.defensePower);
      if (!isNaN(def)) result.stats!.defensePower = def;
      
      const heal = parseInt(visionData.stats.healPower);
      if (!isNaN(heal)) result.stats!.healPower = heal;

      const potHp = parseInt(visionData.stats.hpAbility);
      if (!isNaN(potHp) && potHp > 0) result.potentialLevels!.maxHP = potHp;
      
      const potAtk = parseInt(visionData.stats.atkAbility);
      if (!isNaN(potAtk) && potAtk > 0) result.potentialLevels!.attackPower = potAtk;
      
      const potHeal = parseInt(visionData.stats.healAbility);
      if (!isNaN(potHeal) && potHeal > 0) result.potentialLevels!.healPower = potHeal;
    }

    // Evaluate needsReview
    if (!result.studentId || !result.level) {
      result._needsReview = true;
    }
  } catch (e) {
    console.error("Error parsing vision data:", e);
    result._needsReview = true;
  }

  return result;
}
