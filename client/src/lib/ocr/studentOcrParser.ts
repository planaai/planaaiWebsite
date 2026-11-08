import type { StudentMaster } from '@/types';

export interface SkillLevels {
  ex: number;
  normal: number;
  passive: number;
  sub: number;
}

export interface EquipmentSlot {
  slot: number;
  unequipped: boolean;
  tier: number | null;
  level: number | null;
}

export interface FavoriteItem {
  unequipped: boolean;
  tier: number | null;
}

export interface UniqueWeapon {
  unequipped: boolean;
  starGrade: number | null;
  level: number | null;
}

export interface StatEntry {
  value: number;
  releaseLevel: number | null;
}

export interface NormalizedStudentOcrData {
  studentName: string;
  level: number;
  starGrade: number;
  bondRank: number | null;
  skills: SkillLevels;
  equipments: EquipmentSlot[];
  favoriteItem: FavoriteItem;
  weapon: UniqueWeapon;
  stats: {
    hp: StatEntry;
    atk: StatEntry;
    def: StatEntry;
    heal: StatEntry;
  };
}

export function toOptionalInt(val: unknown): number | null {
  if (val === null || val === undefined || typeof val === 'boolean') {
    return null;
  }
  if (typeof val === 'number') {
    return isNaN(val) ? null : Math.floor(val);
  }
  const text = String(val).trim();
  if (!text || ['null', 'none', 'empty', '-', 'undefined'].includes(text.toLowerCase())) {
    return null;
  }
  const cleaned = text.replace(/,/g, '');
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export function toSkillLevel(val: unknown, isEx: boolean): number {
  const maxLv = isEx ? 5 : 10;
  if (typeof val === 'string') {
    const upper = val.trim().toUpperCase();
    if (upper === 'M' || upper.includes('MAX')) {
      return maxLv;
    }
  }
  const parsed = toOptionalInt(val);
  if (parsed === null) {
    return 1;
  }
  return Math.max(1, Math.min(maxLv, parsed));
}

export function extractJsonObject(rawText: string): Record<string, any> {
  // 1. Strip <think>...</think> tag from reasoning models (even if unclosed at stream end)
  let cleaned = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

  // 2. Strip markdown fences ```json ... ``` or ``` ... ``` anywhere in text (including unclosed fences)
  cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)(?:```|$)/gi, '$1').trim();

  const tryParse = (str: string): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      // ignore
    }

    // Try sanitizing comments, trailing commas, single quotes, unquoted keys
    try {
      const sanitized = str
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/,(\s*,)+/g, ',') // Remove duplicated commas
        .replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas
      let parsed = null;
      try {
        parsed = JSON.parse(sanitized);
      } catch {
        // Fallback 1: replace single quotes around keys/values with double quotes
        const doubleQuoted = sanitized
          .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
          .replace(/,\s*([\]}])/g, '$1');
        try {
          parsed = JSON.parse(doubleQuoted);
        } catch {
          // Fallback 2: quote unquoted object keys (e.g. { studentName: "아루" } -> { "studentName": "아루" })
          const quotedKeys = doubleQuoted.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          parsed = JSON.parse(quotedKeys);
        }
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      // ignore
    }
    return null;
  };

  // 3. Try parsing cleaned text directly
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // 4. Fallback: find outermost '{' and '}'
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error("응답에서 유효한 JSON 객체('{...}')를 찾을 수 없습니다.");
  }

  const candidate = cleaned.slice(startIdx, endIdx + 1);
  const candidateParsed = tryParse(candidate);
  if (candidateParsed) {
    return candidateParsed;
  }

  throw new Error('추출된 JSON 최상위 구조를 해석할 수 없습니다.');
}

export function normalizeEquipmentSlot(slotNum: number, item: unknown): EquipmentSlot {
  if (!item || typeof item !== 'object') {
    return { slot: slotNum, unequipped: true, tier: null, level: null };
  }
  const rawObj = item as Record<string, unknown>;
  const tier = toOptionalInt(rawObj.tier);
  const level = toOptionalInt(rawObj.level);
  let unequipped = Boolean(rawObj.unequipped);

  if (tier === null && level === null) {
    unequipped = true;
  }

  if (unequipped) {
    return { slot: slotNum, unequipped: true, tier: null, level: null };
  }

  return {
    slot: slotNum,
    unequipped: false,
    tier: tier !== null ? tier : 1,
    level: level !== null ? level : 1,
  };
}

export function normalizeStatEntry(item: unknown): StatEntry {
  if (item && typeof item === 'object') {
    const rawObj = item as Record<string, unknown>;
    const val = toOptionalInt(rawObj.value ?? rawObj.val ?? rawObj.stat ?? rawObj['값']);
    let rel = toOptionalInt(
      rawObj.releaseLevel ?? rawObj.release_level ?? rawObj.potential ?? rawObj['능력개방'] ?? rawObj['개방레벨']
    );
    if (rel !== null && rel <= 0) {
      rel = null;
    } else if (rel !== null) {
      rel = Math.min(25, rel);
    }
    return { value: val !== null ? val : 0, releaseLevel: rel };
  }

  const val = toOptionalInt(item);
  return { value: val !== null ? val : 0, releaseLevel: null };
}

export function normalizeOcrData(raw: Record<string, any>): NormalizedStudentOcrData {
  const rawName = String(raw.studentName || raw.student_name || raw.name || raw.student || '')
    .trim()
    .replace(/^["'`]|["'`]$/g, '');
  const studentName = rawName;

  const rawLevel = toOptionalInt(raw.level ?? raw.lvl);
  const level = rawLevel && rawLevel > 0 ? Math.min(90, Math.max(1, rawLevel)) : 1;

  const rawStar = toOptionalInt(raw.starGrade ?? raw.star_grade ?? raw.stars ?? raw.star);
  const starGrade = rawStar && rawStar > 0 ? Math.min(5, Math.max(1, rawStar)) : 3;

  // bondRank: 유효 범위 1~100 (초과/음수 값 방어, troubleshooting.md 규격 준수)
  const rawBond = toOptionalInt(raw.bondRank ?? raw.bond_rank ?? raw.bond);
  const bondRank = rawBond && rawBond > 0 ? Math.min(100, Math.max(1, rawBond)) : null;

  // skills: 객체 또는 배열 형식 지원
  const rawSkills = (raw.skills || raw.skill_levels || raw.skillLevels || {}) as Record<string, any>;
  let exRaw: any;
  let normalRaw: any;
  let passiveRaw: any;
  let subRaw: any;

  if (Array.isArray(rawSkills)) {
    exRaw = rawSkills[0];
    normalRaw = rawSkills[1];
    passiveRaw = rawSkills[2];
    subRaw = rawSkills[3];
  } else if (typeof rawSkills === 'object' && rawSkills !== null) {
    exRaw = rawSkills.ex ?? rawSkills.exSkill ?? rawSkills.ex_skill;
    normalRaw = rawSkills.normal ?? rawSkills.basic ?? rawSkills.normal_skill ?? rawSkills.normalSkill;
    passiveRaw = rawSkills.passive ?? rawSkills.enhanced ?? rawSkills.enh ?? rawSkills.passive_skill ?? rawSkills.passiveSkill;
    subRaw = rawSkills.sub ?? rawSkills.sub_skill ?? rawSkills.subSkill;
  }

  const skills: SkillLevels = {
    ex: toSkillLevel(exRaw, true),
    normal: toSkillLevel(normalRaw, false),
    passive: toSkillLevel(passiveRaw, false),
    sub: toSkillLevel(subRaw, false),
  };

  // equipments: 배열 또는 객체({ slot1, slot2, slot3 }) 형식 지원
  let rawEquips: any[] = [];
  if (Array.isArray(raw.equipments)) {
    rawEquips = raw.equipments;
  } else if (Array.isArray(raw.equipment)) {
    rawEquips = raw.equipment;
  } else if (Array.isArray(raw.gear)) {
    rawEquips = raw.gear;
  } else if (typeof raw.equipments === 'object' && raw.equipments !== null) {
    rawEquips = [
      raw.equipments.slot1 || raw.equipments['1'],
      raw.equipments.slot2 || raw.equipments['2'],
      raw.equipments.slot3 || raw.equipments['3'],
      raw.equipments.slot4 || raw.equipments['4'],
    ];
  }

  const equipments: EquipmentSlot[] = [];
  for (let idx = 0; idx < 3; idx++) {
    equipments.push(normalizeEquipmentSlot(idx + 1, rawEquips[idx]));
  }

  // favoriteItem: 슬롯 4에 배치된 경우 폴백 지원
  const rawFav =
    raw.favoriteItem ??
    raw.favorite_item ??
    raw.favItem ??
    raw.item ??
    (rawEquips.length >= 4 ? rawEquips[3] : undefined);
  let favTier: number | null = null;
  let favUnequipped = false;

  if (rawFav === null || rawFav === undefined) {
    favUnequipped = true;
  } else if (typeof rawFav === 'number' || typeof rawFav === 'string') {
    favTier = toOptionalInt(rawFav);
    favUnequipped = favTier === null;
  } else if (typeof rawFav === 'object') {
    const rawFavObj = rawFav as Record<string, any>;
    favTier = toOptionalInt(rawFavObj.tier ?? rawFavObj.level);
    favUnequipped = Boolean(rawFavObj.unequipped || favTier === null);
  } else {
    favUnequipped = true;
  }

  const favoriteItem: FavoriteItem =
    favUnequipped || favTier === null
      ? { unequipped: true, tier: null }
      : { unequipped: false, tier: Math.max(1, Math.min(2, favTier)) };

  const rawWp = raw.weapon ?? raw.uniqueWeapon ?? raw.unique_weapon;
  let wpStar: number | null = null;
  let wpLevel: number | null = null;
  let wpUnequipped = false;

  if (rawWp === null || rawWp === undefined) {
    wpUnequipped = true;
  } else if (typeof rawWp === 'number') {
    wpStar = toOptionalInt(rawWp);
    wpLevel = 50;
    wpUnequipped = wpStar === null || wpStar <= 0;
  } else if (typeof rawWp === 'object') {
    const rawWpObj = rawWp as Record<string, any>;
    const wpStarSrc = rawWpObj.starGrade ?? rawWpObj.star_grade ?? rawWpObj.stars ?? rawWpObj.star;
    wpStar = toOptionalInt(wpStarSrc);
    wpLevel = toOptionalInt(rawWpObj.level ?? rawWpObj.lvl);
    wpUnequipped = Boolean(rawWpObj.unequipped);
    if ((wpStar === null || wpStar <= 0) && wpLevel === null) {
      wpUnequipped = true;
    }
  } else {
    wpUnequipped = true;
  }

  const weapon: UniqueWeapon = wpUnequipped
    ? { unequipped: true, starGrade: null, level: null }
    : {
        unequipped: false,
        starGrade: Math.max(1, Math.min(4, wpStar || 1)),
        level: wpLevel !== null ? Math.max(1, Math.min(60, wpLevel)) : 1,
      };

  // stats: 한글 키 지원
  const rawStats = (raw.stats || raw.status || raw.stat || {}) as Record<string, any>;
  const hpRaw = rawStats.hp ?? rawStats.maxHP ?? rawStats.max_hp ?? rawStats['최대체력'] ?? rawStats['체력'];
  const atkRaw = rawStats.atk ?? rawStats.attack ?? rawStats.attackPower ?? rawStats['공격력'];
  const defRaw = rawStats.def ?? rawStats.defense ?? rawStats.defensePower ?? rawStats['방어력'];
  const healRaw = rawStats.heal ?? rawStats.healing ?? rawStats.healPower ?? rawStats['치유력'];

  const stats = {
    hp: normalizeStatEntry(hpRaw),
    atk: normalizeStatEntry(atkRaw),
    def: normalizeStatEntry(defRaw),
    heal: normalizeStatEntry(healRaw),
  };

  return {
    studentName,
    level,
    starGrade,
    bondRank,
    skills,
    equipments,
    favoriteItem,
    weapon,
    stats,
  };
}

/**
 * 학생명으로 StudentMaster 데이터 매칭 (대소문자 무시, 공백 무시, 특수문자 대응, 역할군 접두어/접미어 대응)
 */
export function findStudentMasterByName(
  name: string,
  masterData: StudentMaster[]
): StudentMaster | undefined {
  if (!name || !Array.isArray(masterData) || masterData.length === 0) return undefined;
  
  // 1. 역할군 배지 제거 (예: "STRIKER 아루", "[SPECIAL] 히비키", "아루 (STRIKER)")
  let cleanName = name
    .trim()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/[\[\(（]?(?:striker|special|스트라이커|스페셜)[\]\)）]?/gi, '')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .trim();

  if (!cleanName) return undefined;

  // 전각 괄호 반각 통일
  cleanName = cleanName.replace(/（/g, '(').replace(/）/g, ')');

  // 1. 정확한 이름 일치
  const exact = masterData.find(m => m.name === cleanName);
  if (exact) return exact;

  // 2. 공백 및 대소문자 무시 일치
  const normalizeForMatch = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[（(]/g, '(')
      .replace(/[）)]/g, ')');

  const normalizedTarget = normalizeForMatch(cleanName);
  const normalizedMatch = masterData.find(m => normalizeForMatch(m.name) === normalizedTarget);
  if (normalizedMatch) return normalizedMatch;

  // 3. 특수 기호 변형 매칭 (예: "시로코*테러" <-> "시로코(테러)")
  const stripSpecial = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\s\*\_\-\·\・\•\/\(\)\[\]（）]/g, '');

  const strippedTarget = stripSpecial(cleanName);
  const strippedMatch = masterData.find(m => stripSpecial(m.name) === strippedTarget);
  if (strippedMatch) return strippedMatch;

  // 4. 의상/버전 접두어 변환 (예: "수영복 하나코" -> "하나코(수영복)", "신년 아루" -> "아루(새해)")
  const variantPrefixRegex = /^(수영복|드레스|새해|신년|온천|사복|치어리더|응원단|가이드|무장|캠핑|라이딩|바니걸|아이돌|밴드)\s*(.+)$/i;
  const prefixMatch = cleanName.match(variantPrefixRegex);
  if (prefixMatch) {
    const rawVariant = prefixMatch[1];
    const baseName = prefixMatch[2].trim();
    const variant = rawVariant === '신년' ? '새해' : rawVariant === '응원단' ? '치어리더' : rawVariant;
    const transformed1 = `${baseName}(${variant})`;
    const transformed2 = `${baseName}(${rawVariant})`;
    const matchTransformed = masterData.find(
      m =>
        stripSpecial(m.name) === stripSpecial(transformed1) ||
        stripSpecial(m.name) === stripSpecial(transformed2)
    );
    if (matchTransformed) return matchTransformed;
    // 명시적인 의상/버전 접두어가 있으나 해당 이격 학생이 마스터에 없는 경우
    // 기본형 학생으로 오매칭되는 것을 방지하기 위해 부분 일치로 넘어가지 않고 undefined 반환
    return undefined;
  }

  // 5. 고유한 부분 문자열 일치 (동음이의어 오매칭 방지: 타깃 길이가 2자 이상일 때만)
  if (strippedTarget.length >= 2) {
    const partialMatches = masterData.filter(m => {
      const sName = stripSpecial(m.name);
      return sName.includes(strippedTarget) || strippedTarget.includes(sName);
    });
    if (partialMatches.length === 1) {
      return partialMatches[0];
    }
  }

  return undefined;
}

export interface MappedFormValues {
  studentId?: number;
  level: number;
  currentStars: number;
  bondRank?: number;
  skillLevels: { ex: number; normal: number; passive: number; sub: number };
  equipment: {
    slot1: { tier: number; level: number } | null;
    slot2: { tier: number; level: number } | null;
    slot3: { tier: number; level: number } | null;
    slot4: { tier: number; level: number } | null;
  };
  uniqueWeapon: { stars: number; level: number } | null;
  stats: Record<string, number | null>;
  potentialLevels: Record<string, number | null>;
  matchedMaster?: StudentMaster;
}

/**
 * 정규화된 OCR 결과를 학생 등록 폼 스키마 규격으로 매핑
 */
export function mapOcrDataToFormValues(
  ocrData: NormalizedStudentOcrData,
  masterData: StudentMaster[]
): MappedFormValues {
  const matchedMaster = findStudentMasterByName(ocrData.studentName, masterData);

  const slot1 = ocrData.equipments[0]?.unequipped
    ? null
    : { tier: ocrData.equipments[0]?.tier || 1, level: ocrData.equipments[0]?.level || 1 };
  const slot2 = ocrData.equipments[1]?.unequipped
    ? null
    : { tier: ocrData.equipments[1]?.tier || 1, level: ocrData.equipments[1]?.level || 1 };
  const slot3 = ocrData.equipments[2]?.unequipped
    ? null
    : { tier: ocrData.equipments[2]?.tier || 1, level: ocrData.equipments[2]?.level || 1 };

  // slot4는 애용품
  const slot4 = ocrData.favoriteItem.unequipped
    ? null
    : { tier: ocrData.favoriteItem.tier || 1, level: 1 };

  // 전용무기: unequipped인 경우 ArchiveRecord 스키마 규격에 맞춰 null 반환
  const uniqueWeapon = ocrData.weapon.unequipped
    ? null
    : { stars: ocrData.weapon.starGrade || 1, level: ocrData.weapon.level || 1 };

  return {
    studentId: matchedMaster?.id,
    level: ocrData.level,
    currentStars: ocrData.starGrade,
    bondRank: ocrData.bondRank ?? undefined,
    skillLevels: {
      ex: ocrData.skills.ex,
      normal: ocrData.skills.normal,
      passive: ocrData.skills.passive,
      sub: ocrData.skills.sub,
    },
    equipment: {
      slot1,
      slot2,
      slot3,
      slot4,
    },
    uniqueWeapon,
    stats: {
      maxHP: ocrData.stats.hp.value,
      attackPower: ocrData.stats.atk.value,
      defensePower: ocrData.stats.def.value,
      healPower: ocrData.stats.heal.value,
    },
    potentialLevels: {
      maxHP: ocrData.stats.hp.releaseLevel || null,
      attackPower: ocrData.stats.atk.releaseLevel || null,
      defensePower: ocrData.stats.def.releaseLevel || null,
      healPower: ocrData.stats.heal.releaseLevel || null,
    },
    matchedMaster,
  };
}
