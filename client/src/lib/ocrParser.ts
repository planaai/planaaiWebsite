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

    const response = await fetch(`api/archive/upload-vision`, {
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
    if (visionData?.student_info?.name) {
      const nameWithoutSpaces = visionData.student_info.name.replace(/\s+/g, '');
      const sortedMaster = [...masterData].sort((a, b) => b.name.length - a.name.length);
      const detectedStudent = sortedMaster.find(m => nameWithoutSpaces.includes(m.name.replace(/\s+/g, '')));
      if (detectedStudent) {
        result.studentId = detectedStudent.id;
      }
    }

    // 2. Level & Affinity
    if (visionData?.student_info?.level) {
      const lv = parseInt(visionData.student_info.level);
      if (!isNaN(lv)) result.level = lv;
    }
    if (visionData?.student_info?.affinity) {
      const aff = parseInt(visionData.student_info.affinity);
      if (!isNaN(aff)) result.bondRank = aff;
    }

    // 3. Skills
    if (visionData?.skills) {
      const parseSkill = (val: any, isEx: boolean) => {
        if (val === undefined || val === null || val === '') return 1;
        const strVal = String(val);
        if (strVal.toUpperCase() === 'MAX') return isEx ? 5 : 10;
        const num = parseInt(strVal.replace(/\D/g, ''));
        return isNaN(num) ? 1 : num;
      };
      result.skillLevels!.ex = parseSkill(visionData.skills.ex, true);
      result.skillLevels!.normal = parseSkill(visionData.skills.normal, false);
      result.skillLevels!.passive = parseSkill(visionData.skills.enhanced, false);
      result.skillLevels!.sub = parseSkill(visionData.skills.sub, false);
    }

    // 4. Stars & Unique Weapon
    if (visionData?.star_counts) {
      if (visionData.star_counts.student_stars_yellow) {
        result.currentStars = parseInt(visionData.star_counts.student_stars_yellow);
      }
    }
    
    let hasUniqueWeapon = false;
    if (typeof visionData?.has_unique_weapon === 'boolean') {
      hasUniqueWeapon = visionData.has_unique_weapon;
    } else if (visionData?.weapon && visionData.weapon.level && String(visionData.weapon.level) !== "0") {
      hasUniqueWeapon = true;
    }
    
    if (hasUniqueWeapon) {
      const wStars = parseInt(visionData?.star_counts?.weapon_stars_blue);
      const wLevel = parseInt(visionData?.weapon?.level);
      
      result.uniqueWeapon = {
        stars: !isNaN(wStars) && wStars > 0 ? Math.min(wStars, 4) : 1, // Clamp to max 4
        level: !isNaN(wLevel) ? wLevel : 1
      };
    }

    // 5. Equipment
    if (visionData?.equipment) {
      const parseTier = (t: string) => {
        if (!t) return null;
        const match = t.match(/T(\d+)/i);
        return match ? parseInt(match[1]) : null;
      };
      const parseLevel = (l: string) => l ? parseInt(l) : null;
      
      const t1 = parseTier(visionData.equipment.slot1);
      if (t1) result.equipment!.slot1 = { tier: t1, level: parseLevel(visionData.equipment_level?.slot1) || (t1 * 10 - 5) };
      
      const t2 = parseTier(visionData.equipment.slot2);
      if (t2) result.equipment!.slot2 = { tier: t2, level: parseLevel(visionData.equipment_level?.slot2) || (t2 * 10 - 5) };
      
      const t3 = parseTier(visionData.equipment.slot3);
      if (t3) result.equipment!.slot3 = { tier: t3, level: parseLevel(visionData.equipment_level?.slot3) || (t3 * 10 - 5) };
      
      const t4 = parseTier(visionData.equipment.favorite_item);
      if (t4) result.equipment!.slot4 = { tier: t4, level: 1 };
    }

    // 6. Stats & Potential
    if (visionData?.stats) {
      const parseStat = (s: any) => {
        if (!s || s.value === undefined || s.value === null) return null;
        return parseInt(String(s.value).replace(/\D/g, ''));
      };
      const parsePot = (s: any) => {
        if (!s || s.ability_release_level === undefined || s.ability_release_level === null) return null;
        return parseInt(String(s.ability_release_level).replace(/\D/g, ''));
      };
      
      const hp = parseStat(visionData.stats.hp);
      if (!isNaN(hp as any) && hp !== null) result.stats!.maxHP = hp;
      const atk = parseStat(visionData.stats.attack);
      if (!isNaN(atk as any) && atk !== null) result.stats!.attackPower = atk;
      const def = parseStat(visionData.stats.defense);
      if (!isNaN(def as any) && def !== null) result.stats!.defensePower = def;
      const heal = parseStat(visionData.stats.healing);
      if (!isNaN(heal as any) && heal !== null) result.stats!.healPower = heal;

      const potHp = parsePot(visionData.stats.hp);
      if (!isNaN(potHp as any) && potHp !== null) result.potentialLevels!.maxHP = potHp;
      const potAtk = parsePot(visionData.stats.attack);
      if (!isNaN(potAtk as any) && potAtk !== null) result.potentialLevels!.attackPower = potAtk;
      const potHeal = parsePot(visionData.stats.healing);
      if (!isNaN(potHeal as any) && potHeal !== null) result.potentialLevels!.healPower = potHeal;
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
