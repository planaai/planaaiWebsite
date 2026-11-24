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
  value: number | null;
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

export type OcrSlotName = 'main' | 'equip1' | 'equip2' | 'equip3' | 'favorite';
export type OcrSceneType = 'student_info' | 'equipment_modal' | 'favorite_popup';

export interface OcrMeta {
  engine: string;
  preset: string;
  scenes: {
    main: 'student_info';
    equip1?: 'equipment_modal';
    equip2?: 'equipment_modal';
    equip3?: 'equipment_modal';
    favorite?: 'favorite_popup';
  };
  fieldSources: Record<string, OcrSlotName>;
  needsReview: string[];
  studentMatch: {
    raw: string;
    score: number;
  };
  elapsedMs: number;
}

export interface OcrErrorResponse {
  success?: false;
  code: string;
  message?: string;
  error?: string;
  detail?: {
    slot?: OcrSlotName;
    detected?: OcrSceneType | 'unknown' | null;
    expected?: OcrSceneType;
    activeSlot?: 1 | 2 | 3;
    conflictingWith?: 'equip1' | 'equip2' | 'equip3';
    [key: string]: unknown;
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
