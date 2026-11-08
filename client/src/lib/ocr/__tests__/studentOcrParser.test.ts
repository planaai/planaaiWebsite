import {
  extractJsonObject,
  normalizeOcrData,
  findStudentMasterByName,
  mapOcrDataToFormValues,
  toOptionalInt,
  toSkillLevel,
  type NormalizedStudentOcrData,
} from '../studentOcrParser';
import type { StudentMaster } from '@/types';

describe('studentOcrParser', () => {
  describe('extractJsonObject', () => {
    it('strips <think>...</think> reasoning tags and markdown fences', () => {
      const raw = `<think>노란 별 5개, 하늘색 별 4개 확인</think>
\`\`\`json
{
  "studentName": "하나코(수영복)",
  "level": 90,
  "starGrade": 5
}
\`\`\``;
      const parsed = extractJsonObject(raw);
      expect(parsed.studentName).toBe('하나코(수영복)');
      expect(parsed.level).toBe(90);
      expect(parsed.starGrade).toBe(5);
    });

    it('extracts embedded JSON when surrounding text exists', () => {
      const raw = `다음은 추출된 결과입니다:
{"studentName": "아루", "level": 90}
감사합니다.`;
      const parsed = extractJsonObject(raw);
      expect(parsed.studentName).toBe('아루');
      expect(parsed.level).toBe(90);
    });

    it('recovers from trailing commas and single-line comments in LLM JSON', () => {
      const raw = `
// LLM reasoning output
{
  "studentName": "아루",
  "level": 90,
  "skills": {
    "ex": 5,
    "normal": 10,
    "passive": 10,
    "sub": 10,
  },
}
`;
      const parsed = extractJsonObject(raw);
      expect(parsed.studentName).toBe('아루');
      expect(parsed.level).toBe(90);
      expect(parsed.skills.sub).toBe(10);
    });

    it('handles unclosed <think> tag gracefully', () => {
      const raw = `<think>
I need to parse this Blue Archive student card.
Yellow stars: 5
{
  "studentName": "아루",
  "level": 90
}`;
      const parsed = extractJsonObject(raw);
      expect(parsed.studentName).toBe('아루');
      expect(parsed.level).toBe(90);
    });

    it('handles Python-style single quotes and unclosed markdown fences', () => {
      const raw = "```json\n{'studentName': '아루', 'level': 90, 'starGrade': 5}\n";
      const parsed = extractJsonObject(raw);
      expect(parsed.studentName).toBe('아루');
      expect(parsed.level).toBe(90);
      expect(parsed.starGrade).toBe(5);
    });

    it('throws error when no JSON object is found', () => {
      expect(() => extractJsonObject('오류가 발생하여 결과를 찾을 수 없습니다.')).toThrow(
        "응답에서 유효한 JSON 객체('{...}')를 찾을 수 없습니다."
      );
    });
  });

  describe('toOptionalInt and toSkillLevel', () => {
    it('converts formatted strings to numbers', () => {
      expect(toOptionalInt('Lv.90')).toBe(90);
      expect(toOptionalInt('T10')).toBe(10);
      expect(toOptionalInt('43,908')).toBe(43908);
      expect(toOptionalInt(null)).toBeNull();
      expect(toOptionalInt('EMPTY')).toBeNull();
      expect(toOptionalInt('-')).toBeNull();
    });

    it('handles MAX skill levels', () => {
      expect(toSkillLevel('MAX', true)).toBe(5);
      expect(toSkillLevel('MAX', false)).toBe(10);
      expect(toSkillLevel('M', true)).toBe(5);
      expect(toSkillLevel('M', false)).toBe(10);
      expect(toSkillLevel(3, true)).toBe(3);
      expect(toSkillLevel('Lv.7', false)).toBe(7);
      expect(toSkillLevel(null, false)).toBe(1);
    });
  });

  describe('normalizeOcrData', () => {
    it('normalizes Hanako (Swimsuit) sample with Lv.25 ability release', () => {
      const raw = {
        studentName: '하나코(수영복)',
        level: 'Lv.90',
        starGrade: 5,
        bondRank: 12,
        skills: { ex: 'MAX', normal: 'MAX', passive: 'MAX', sub: 'MAX' },
        equipments: [
          { slot: 1, unequipped: false, tier: 'T10', level: 'Lv.70' },
          { slot: 2, unequipped: false, tier: 7, level: 55 },
          { slot: 3, unequipped: false, tier: 8, level: 60 },
        ],
        favoriteItem: { unequipped: true, tier: null },
        weapon: { unequipped: false, starGrade: 4, level: 60 },
        stats: {
          hp: { value: 43908, releaseLevel: 'Lv.25' },
          atk: { value: 7881, releaseLevel: 25 },
          def: { value: 109, releaseLevel: null },
          heal: { value: 6042, releaseLevel: 25 },
        },
      };

      const norm = normalizeOcrData(raw);

      expect(norm.studentName).toBe('하나코(수영복)');
      expect(norm.level).toBe(90);
      expect(norm.starGrade).toBe(5);
      expect(norm.bondRank).toBe(12);
      expect(norm.skills).toEqual({ ex: 5, normal: 10, passive: 10, sub: 10 });
      expect(norm.equipments[0]).toEqual({ slot: 1, unequipped: false, tier: 10, level: 70 });
      expect(norm.equipments[1]).toEqual({ slot: 2, unequipped: false, tier: 7, level: 55 });
      expect(norm.equipments[2]).toEqual({ slot: 3, unequipped: false, tier: 8, level: 60 });
      expect(norm.favoriteItem).toEqual({ unequipped: true, tier: null });
      expect(norm.weapon).toEqual({ unequipped: false, starGrade: 4, level: 60 });
      expect(norm.stats.hp).toEqual({ value: 43908, releaseLevel: 25 });
      expect(norm.stats.atk).toEqual({ value: 7881, releaseLevel: 25 });
      expect(norm.stats.def).toEqual({ value: 109, releaseLevel: null });
      expect(norm.stats.heal).toEqual({ value: 6042, releaseLevel: 25 });
    });

    it('normalizes Aru sample with T2 favorite item', () => {
      const raw = {
        studentName: '아루',
        level: 90,
        starGrade: 5,
        bondRank: 20,
        skills: { ex: 5, normal: 10, passive: 10, sub: 10 },
        equipments: [
          { slot: 1, tier: 8, level: 60 },
          { slot: 2, tier: 8, level: 60 },
          { slot: 3, tier: 8, level: 60 },
        ],
        favoriteItem: { unequipped: false, tier: 'T2' },
        weapon: { unequipped: false, starGrade: 3, level: 50 },
        stats: {
          hp: { value: 39877, releaseLevel: null },
          atk: { value: 8932, releaseLevel: null },
          def: { value: 109, releaseLevel: null },
          heal: { value: 5694, releaseLevel: null },
        },
      };

      const norm = normalizeOcrData(raw);

      expect(norm.studentName).toBe('아루');
      expect(norm.favoriteItem).toEqual({ unequipped: false, tier: 2 });
      expect(norm.weapon.starGrade).toBe(3);
      expect(norm.weapon.level).toBe(50);
    });

    it('handles unequipped / locked weapon and empty slots safely', () => {
      const raw = {
        studentName: '히후미',
        level: 50,
        starGrade: 3,
        weapon: { unequipped: true },
        equipments: [],
      };

      const norm = normalizeOcrData(raw);

      expect(norm.weapon).toEqual({ unequipped: true, starGrade: null, level: null });
      expect(norm.equipments.length).toBe(3);
      expect(norm.equipments[0].unequipped).toBe(true);
      expect(norm.equipments[1].unequipped).toBe(true);
      expect(norm.equipments[2].unequipped).toBe(true);
      expect(norm.favoriteItem).toEqual({ unequipped: true, tier: null });
    });
  });

  describe('findStudentMasterByName & mapOcrDataToFormValues', () => {
    const mockMasterData: StudentMaster[] = [
      {
        id: 101,
        studentNumber: 1,
        name: '아루',
        school: 'Gehenna',
        fieldType: 'Striker',
        Role: 'Dealer',
        attackType: 'Explosion',
        armorType: 'Light',
        weaponType: 'SR',
        position: 'Back',
        starNum: 3,
        hasFavoriteItem: true,
        equipmentSlot1: 'Hat',
        equipmentSlot2: 'Hairpin',
        equipmentSlot3: 'Watch',
        portraitUrls: ['/images/aru.png'],
        skills: [],
      },
      {
        id: 102,
        studentNumber: 2,
        name: '하나코(수영복)',
        school: 'Trinity',
        fieldType: 'Striker',
        Role: 'Dealer',
        attackType: 'Sonic',
        armorType: 'Special',
        weaponType: 'AR',
        position: 'Middle',
        starNum: 3,
        hasFavoriteItem: false,
        equipmentSlot1: 'Shoes',
        equipmentSlot2: 'Badge',
        equipmentSlot3: 'Charm',
        portraitUrls: ['/images/hanako_swimsuit.png'],
        skills: [],
      },
      {
        id: 103,
        studentNumber: 3,
        name: '시로코*테러',
        school: 'Abydos',
        fieldType: 'Striker',
        Role: 'Dealer',
        attackType: 'Mystic',
        armorType: 'Heavy',
        weaponType: 'AR',
        position: 'Middle',
        starNum: 3,
        hasFavoriteItem: false,
        equipmentSlot1: 'Gloves',
        equipmentSlot2: 'Hairpin',
        equipmentSlot3: 'Watch',
        portraitUrls: ['/images/shiroko_terror.png'],
        skills: [],
      },
    ];

    it('matches student by exact and variant names and strips role badge prefixes', () => {
      expect(findStudentMasterByName('아루', mockMasterData)?.id).toBe(101);
      expect(findStudentMasterByName('STRIKER 아루', mockMasterData)?.id).toBe(101);
      expect(findStudentMasterByName('[STRIKER] 아루', mockMasterData)?.id).toBe(101);
      expect(findStudentMasterByName('아루 (STRIKER)', mockMasterData)?.id).toBe(101);
      expect(findStudentMasterByName('SPECIAL 아루', mockMasterData)?.id).toBe(101);
      expect(findStudentMasterByName('하나코(수영복)', mockMasterData)?.id).toBe(102);
      expect(findStudentMasterByName('하나코（수영복）', mockMasterData)?.id).toBe(102);
      // variant matching with asterisk vs parentheses
      expect(findStudentMasterByName('시로코(테러)', mockMasterData)?.id).toBe(103);
      expect(findStudentMasterByName(' 시로코*테러 ', mockMasterData)?.id).toBe(103);
      expect(findStudentMasterByName('미등록학생', mockMasterData)).toBeUndefined();
    });

    it('maps unequipped uniqueWeapon to null in ArchiveRecord schema', () => {
      const ocrData: NormalizedStudentOcrData = {
        studentName: '아루',
        level: 50,
        starGrade: 3,
        bondRank: 10,
        skills: { ex: 3, normal: 7, passive: 7, sub: 7 },
        equipments: [
          { slot: 1, unequipped: true, tier: null, level: null },
          { slot: 2, unequipped: true, tier: null, level: null },
          { slot: 3, unequipped: true, tier: null, level: null },
        ],
        favoriteItem: { unequipped: true, tier: null },
        weapon: { unequipped: true, starGrade: null, level: null },
        stats: {
          hp: { value: 10000, releaseLevel: null },
          atk: { value: 2000, releaseLevel: null },
          def: { value: 50, releaseLevel: null },
          heal: { value: 1000, releaseLevel: null },
        },
      };

      const mapped = mapOcrDataToFormValues(ocrData, mockMasterData);
      expect(mapped.uniqueWeapon).toBeNull();
      expect(mapped.equipment.slot1).toBeNull();
      expect(mapped.equipment.slot4).toBeNull();
    });

    it('maps normalized OCR data to registration form fields', () => {
      const ocrData: NormalizedStudentOcrData = {
        studentName: '아루',
        level: 90,
        starGrade: 5,
        bondRank: 25,
        skills: { ex: 5, normal: 10, passive: 10, sub: 10 },
        equipments: [
          { slot: 1, unequipped: false, tier: 10, level: 70 },
          { slot: 2, unequipped: false, tier: 8, level: 60 },
          { slot: 3, unequipped: false, tier: 8, level: 60 },
        ],
        favoriteItem: { unequipped: false, tier: 2 },
        weapon: { unequipped: false, starGrade: 3, level: 50 },
        stats: {
          hp: { value: 39877, releaseLevel: 25 },
          atk: { value: 8932, releaseLevel: 25 },
          def: { value: 109, releaseLevel: null },
          heal: { value: 5694, releaseLevel: null },
        },
      };

      const mapped = mapOcrDataToFormValues(ocrData, mockMasterData);

      expect(mapped.studentId).toBe(101);
      expect(mapped.level).toBe(90);
      expect(mapped.currentStars).toBe(5);
      expect(mapped.bondRank).toBe(25);
      expect(mapped.skillLevels).toEqual({ ex: 5, normal: 10, passive: 10, sub: 10 });
      expect(mapped.equipment.slot1).toEqual({ tier: 10, level: 70 });
      expect(mapped.equipment.slot2).toEqual({ tier: 8, level: 60 });
      expect(mapped.equipment.slot3).toEqual({ tier: 8, level: 60 });
      expect(mapped.equipment.slot4).toEqual({ tier: 2, level: 1 });
      expect(mapped.uniqueWeapon).toEqual({ stars: 3, level: 50 });
      expect(mapped.stats.maxHP).toBe(39877);
      expect(mapped.stats.attackPower).toBe(8932);
      expect(mapped.potentialLevels.maxHP).toBe(25);
      expect(mapped.potentialLevels.defensePower).toBeNull();
    });

    it('matches costume variant prefix like 수영복 하나코 to 하나코(수영복)', () => {
      expect(findStudentMasterByName('수영복 하나코', mockMasterData)?.id).toBe(102);
      expect(findStudentMasterByName('수영복하나코', mockMasterData)?.id).toBe(102);
      expect(findStudentMasterByName('시로코(테러)', mockMasterData)?.id).toBe(103);
    });

    it('handles Lv.MAX and M skill level variants', () => {
      expect(toSkillLevel('Lv.MAX', true)).toBe(5);
      expect(toSkillLevel('Lv.MAX', false)).toBe(10);
      expect(toSkillLevel('MAX', false)).toBe(10);
      expect(toSkillLevel('M', false)).toBe(10);
    });

    it('clamps bondRank (1-100) and potential level (1-25) and weapon level (1-60)', () => {
      const raw = {
        studentName: '아루',
        level: 90,
        bondRank: 9999,
        weapon: { unequipped: false, starGrade: 3, level: 500 },
        stats: {
          '최대체력': { '값': 40000, '능력개방': 'Lv.90' },
          '공격력': { '값': 8000, '개방레벨': 50 },
        },
      };
      const norm = normalizeOcrData(raw);
      expect(norm.bondRank).toBe(100);
      expect(norm.weapon.level).toBe(60);
      expect(norm.stats.hp.releaseLevel).toBe(25);
      expect(norm.stats.atk.releaseLevel).toBe(25);
    });
  });
});
