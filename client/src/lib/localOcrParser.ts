import Tesseract from 'tesseract.js';
import type { ArchiveRecord, StudentMaster } from '@/types';

export interface OCRResult {
  parsedData: Partial<ArchiveRecord> & { _needsReview?: boolean };
  rawText: string;
  error?: string;
}

const ROI_CONFIG = {
  studentName: { x: 85, y: 835, w: 350, h: 45 },
  bondRank: { x: 50, y: 835, w: 60, h: 40 },
  currentLevel: { x: 20, y: 880, w: 100, h: 40 },
  stars_area: { x: 390, y: 840, w: 150, h: 40 },
  skill_ex: { x: 1000, y: 580, w: 120, h: 60 },
  skill_basic: { x: 1180, y: 580, w: 120, h: 60 },
  skill_enh: { x: 1340, y: 580, w: 120, h: 60 },
  skill_sub: { x: 1500, y: 580, w: 120, h: 60 },
  weapon_level: { x: 1200, y: 680, w: 80, h: 60 },
  weapon_stars_area: { x: 1550, y: 750, w: 100, h: 40 },
  equip_1: { x: 1020, y: 800, w: 80, h: 80 },
  equip_2: { x: 1160, y: 800, w: 80, h: 80 },
  equip_3: { x: 1300, y: 800, w: 80, h: 80 },
  equip_4: { x: 1440, y: 800, w: 80, h: 80 },
  stat_hp: { x: 1130, y: 340, w: 180, h: 50 },
  stat_attack: { x: 1400, y: 340, w: 180, h: 50 },
  stat_defense: { x: 1110, y: 390, w: 90, h: 50 },
  stat_heal: { x: 1400, y: 390, w: 180, h: 50 }
};

// Jamo splitting
function split_jamo(text: string): string {
  const CHOSUNG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const JUNGSUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
  const JONGSUNG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char >= '가' && char <= '힣') {
      const char_code = char.charCodeAt(0) - 44032;
      const cho = Math.floor(char_code / 588);
      const jung = Math.floor((char_code - (588 * cho)) / 28);
      const jong = char_code - (588 * cho) - (28 * jung);
      result += CHOSUNG[cho] + JUNGSUNG[jung] + (jong > 0 ? JONGSUNG[jong] : "");
    } else {
      result += char;
    }
  }
  return result;
}

function split_jamo_char(char: string) {
  if (char >= '가' && char <= '힣') {
    const code = char.charCodeAt(0) - 44032;
    const cho = Math.floor(code / 588);
    const jung = Math.floor((code - 588 * cho) / 28);
    const jong = code - 588 * cho - 28 * jung;
    return [cho, jung, jong];
  }
  return null;
}

function char_similarity(c1: string, c2: string) {
  const j1 = split_jamo_char(c1);
  const j2 = split_jamo_char(c2);
  if (!j1 || !j2) return c1 === c2 ? 1.0 : 0.0;
  let score = 0;
  if (j1[0] === j2[0]) score += 1;
  if (j1[1] === j2[1]) score += 1;
  if (j1[2] === j2[2]) score += 1;
  return score / 3.0;
}

function name_similarity(ocr_text: string, candidate: string) {
  const ocr_k = ocr_text.replace(/[^가-힣]/g, '');
  const name_k = candidate.replace(/[^가-힣]/g, '');
  if (!ocr_k || !name_k) return 0.0;
  
  if (Math.abs(ocr_k.length - name_k.length) > 1) return 0.3;
  
  const min_len = Math.min(ocr_k.length, name_k.length);
  const max_len = Math.max(ocr_k.length, name_k.length);
  
  let total = 0;
  for (let i = 0; i < min_len; i++) {
    total += char_similarity(ocr_k[i], name_k[i]);
  }
  
  if (ocr_k === name_k) return 1.0;
  return total / max_len;
}

function match_student_name(extracted_name: string, masterData: StudentMaster[]): number | null {
  let clean_ex = extracted_name.replace(/[^가-힣a-zA-Z0-9]/g, '');
  if (!clean_ex) return null;
  
  const ocr_fallbacks: Record<string, string> = {
    "숲": "슌", "순": "슌", "숨": "슌", "슘": "슌",
    "스프미": "스즈미", "치하로": "치히로",
    "소구호미사키": "쇼쿠호미사키", "사례루이코": "사텐루이코",
  };
  for (const bad in ocr_fallbacks) {
    if (clean_ex.startsWith(bad)) {
      clean_ex = ocr_fallbacks[bad] + clean_ex.substring(bad.length);
      break;
    }
  }
  
  const exact_fallbacks: Record<string, string> = {
    "레이": "케이", "켜이": "케이", "웨이": "케이"
  };
  if (exact_fallbacks[clean_ex]) {
    clean_ex = exact_fallbacks[clean_ex];
  }
  
  let best_match: StudentMaster | null = null;
  let best_ratio = 0.0;
  
  for (const student of masterData) {
    const orig_n = student.name;
    const ratio = name_similarity(clean_ex, orig_n);
    if (ratio > best_ratio) {
      best_ratio = ratio;
      best_match = student;
    } else if (ratio === best_ratio && ratio > 0) {
      if (orig_n === orig_n.split('(')[0] && best_match && best_match.name !== best_match.name.split('(')[0]) {
        best_match = student;
      }
    }
  }
  
  if (best_match && best_ratio >= 0.65) {
    return best_match.id;
  }
  return null;
}

// Convert RGB to HSV
function rgbToHsv(r: number, g: number, b: number) {
  r /= 255, g /= 255, b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 180), Math.round(s * 255), Math.round(v * 255)]; // OpenCV format
}

function countStars(imageData: ImageData, isWeapon: boolean = false): number {
  const data = imageData.data;
  let matchedPixels = 0;
  
  const h_min = isWeapon ? 80 : 15;
  const h_max = isWeapon ? 110 : 40;
  const s_min = 100, v_min = 100;
  
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, v] = rgbToHsv(data[i], data[i+1], data[i+2]);
    if (h >= h_min && h <= h_max && s >= s_min && v >= v_min) {
      matchedPixels++;
    }
  }
  
  const expectedPixelsPerStar = isWeapon ? 180 : 120;
  const count = Math.round(matchedPixels / expectedPixelsPerStar);
  return Math.min(Math.max(count, 0), 5);
}

function extractEquipTier4(imageData: ImageData): number {
  const data = imageData.data;
  let pinkPixels = 0;
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < 40; x++) {
      const i = (y * imageData.width + x) * 4;
      const [h, s, v] = rgbToHsv(data[i], data[i+1], data[i+2]);
      if ((h <= 10 || h >= 160) && s >= 30 && v >= 150) {
        pinkPixels++;
      }
    }
  }
  let filled = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] > 0) filled++;
  }
  if (filled < 500) return 0;
  return pinkPixels > 200 ? 2 : 1;
}

function parse_number(text: string): number | null {
  if (!text) return null;
  const match = text.match(/\d+/g);
  if (match) return parseInt(match.join(''), 10);
  return null;
}

function parse_stat_with_ability(text: string) {
  let stat = null;
  let ability = null;
  if (!text) return { stat, ability };
  const match = text.match(/[Ll][Vv]?\s*(\d+)/);
  if (match) {
    ability = parseInt(match[1]);
    if (ability > 25) ability = 25;
    text = text.substring(0, match.index);
  }
  stat = parse_number(text);
  return { stat, ability };
}

function parse_skill(text: string) {
  if (!text) return 10;
  const num = parse_number(text);
  if (num === null) return 10;
  return num;
}

function parse_equip(text: string) {
  if (!text) return { tier: 0, level: 0 };
  let tier = 1;
  const match_t = text.match(/[Tt]\s*([1-9])/);
  if (match_t) {
    tier = parseInt(match_t[1]);
    text = text.replace(match_t[0], '');
  }
  const num = parse_number(text);
  if (!num) return { tier, level: 1 };
  
  let level = num;
  if (num > 100 && tier === 1) {
    const tier_fallback = parseInt(String(num)[0]);
    const level_fallback = parseInt(String(num).substring(1));
    if (tier_fallback >= 1 && tier_fallback <= 9 && level_fallback >= 1 && level_fallback <= 90) {
      return { tier: tier_fallback, level: level_fallback };
    }
  }
  
  if (level <= 40) tier = Math.max(tier, Math.max(1, Math.floor((level - 1) / 10) + 1));
  else tier = Math.max(tier, Math.min(9, 4 + Math.floor((level - 36) / 5)));
  
  return { tier, level };
}

export async function processScreenshot(imageFile: File, masterData: StudentMaster[], progressCb?: (m: string) => void): Promise<OCRResult> {
  const result: Partial<ArchiveRecord> & { _needsReview?: boolean } = {
    skillLevels: { ex: 1, normal: 1, passive: 1, sub: 1 },
    equipment: { slot1: null, slot2: null, slot3: null, slot4: null },
    stats: {},
    potentialLevels: {}
  };
  
  try {
    progressCb?.("이미지 로드 중...");
    
    const img = new Image();
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = URL.createObjectURL(imageFile);
    });
    await loadPromise;
    URL.revokeObjectURL(img.src);
    
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D context not supported");
    
    ctx.drawImage(img, 0, 0, 1920, 1080);
    
    const getCropCanvas = (roi: {x: number, y: number, w: number, h: number}, scale: number = 1) => {
      const c = document.createElement('canvas');
      c.width = roi.w * scale;
      c.height = roi.h * scale;
      const ctx2 = c.getContext('2d')!;
      ctx2.drawImage(canvas, roi.x, roi.y, roi.w, roi.h, 0, 0, c.width, c.height);
      
      const imgData = ctx2.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i+1] + d[i+2]) / 3;
        d[i] = d[i+1] = d[i+2] = avg;
      }
      ctx2.putImageData(imgData, 0, 0);
      return c.toDataURL('image/png');
    };

    progressCb?.("Tesseract 엔진 초기화 중...");
    const worker = await Tesseract.createWorker('kor+eng');
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    });
    
    progressCb?.("텍스트 분석 중...");
    
    const runOcr = async (roi: any, scale: number = 1, whitelist: string = '') => {
      const cropUrl = getCropCanvas(roi, scale);
      if (whitelist) await worker.setParameters({ tessedit_char_whitelist: whitelist });
      else await worker.setParameters({ tessedit_char_whitelist: '' });
      const res = await worker.recognize(cropUrl);
      return res.data.text.replace(/\s+/g, '');
    };

    const studentNameRaw = await runOcr(ROI_CONFIG.studentName, 3);
    const bondRankRaw = await runOcr(ROI_CONFIG.bondRank, 2, '0123456789');
    const levelRaw = await runOcr(ROI_CONFIG.currentLevel, 2, '0123456789Lv');
    
    const sExRaw = await runOcr(ROI_CONFIG.skill_ex, 2);
    const sBasicRaw = await runOcr(ROI_CONFIG.skill_basic, 2);
    const sEnhRaw = await runOcr(ROI_CONFIG.skill_enh, 2);
    const sSubRaw = await runOcr(ROI_CONFIG.skill_sub, 2);
    
    const wLevelRaw = await runOcr(ROI_CONFIG.weapon_level, 2, '0123456789Lv');
    
    const eq1Raw = await runOcr(ROI_CONFIG.equip_1, 2, 'T0123456789Lv');
    const eq2Raw = await runOcr(ROI_CONFIG.equip_2, 2, 'T0123456789Lv');
    const eq3Raw = await runOcr(ROI_CONFIG.equip_3, 2, 'T0123456789Lv');
    
    const hpRaw = await runOcr(ROI_CONFIG.stat_hp, 2, '0123456789Lv');
    const atkRaw = await runOcr(ROI_CONFIG.stat_attack, 2, '0123456789Lv');
    const defRaw = await runOcr(ROI_CONFIG.stat_defense, 2, '0123456789Lv');
    const healRaw = await runOcr(ROI_CONFIG.stat_heal, 2, '0123456789Lv');
    
    await worker.terminate();

    progressCb?.("데이터 취합 중...");

    const getCropImageData = (roi: {x: number, y: number, w: number, h: number}) => {
      return ctx.getImageData(roi.x, roi.y, roi.w, roi.h);
    };
    
    const studentStarsData = getCropImageData(ROI_CONFIG.stars_area);
    const weaponStarsData = getCropImageData(ROI_CONFIG.weapon_stars_area);
    const equip4Data = getCropImageData(ROI_CONFIG.equip_4);
    
    const studentStars = countStars(studentStarsData, false);
    const weaponStars = countStars(weaponStarsData, true);
    const eq4Tier = extractEquipTier4(equip4Data);

    const studentId = match_student_name(studentNameRaw, masterData);
    if (studentId) result.studentId = studentId;
    
    const bond = parse_number(bondRankRaw);
    if (bond) result.bondRank = bond;
    
    const lv = parse_number(levelRaw);
    if (lv) result.level = lv;
    
    result.currentStars = studentStars > 0 ? studentStars : 1;
    
    const wLv = parse_number(wLevelRaw);
    if (wLv && wLv > 0) {
      result.uniqueWeapon = {
        stars: Math.max(1, Math.min(weaponStars, 4)),
        level: wLv
      };
    }
    
    result.skillLevels!.ex = Math.min(5, parse_skill(sExRaw));
    result.skillLevels!.normal = Math.min(10, parse_skill(sBasicRaw));
    result.skillLevels!.passive = Math.min(10, parse_skill(sEnhRaw));
    result.skillLevels!.sub = Math.min(10, parse_skill(sSubRaw));
    
    const eq1 = parse_equip(eq1Raw);
    const eq2 = parse_equip(eq2Raw);
    const eq3 = parse_equip(eq3Raw);
    
    if (eq1.tier > 0) result.equipment!.slot1 = eq1;
    if (eq2.tier > 0) result.equipment!.slot2 = eq2;
    if (eq3.tier > 0) result.equipment!.slot3 = eq3;
    if (eq4Tier > 0) result.equipment!.slot4 = { tier: eq4Tier, level: 1 };
    
    const hpObj = parse_stat_with_ability(hpRaw);
    const atkObj = parse_stat_with_ability(atkRaw);
    const defObj = parse_stat_with_ability(defRaw);
    const healObj = parse_stat_with_ability(healRaw);
    
    if (hpObj.stat) result.stats!.maxHP = hpObj.stat;
    if (atkObj.stat) result.stats!.attackPower = atkObj.stat;
    if (defObj.stat) result.stats!.defensePower = defObj.stat;
    if (healObj.stat) result.stats!.healPower = healObj.stat;
    
    if (hpObj.ability) result.potentialLevels!.maxHP = hpObj.ability;
    if (atkObj.ability) result.potentialLevels!.attackPower = atkObj.ability;
    if (healObj.ability) result.potentialLevels!.healPower = healObj.ability;
    
    if (!result.studentId || !result.level) {
      result._needsReview = true;
    }
    
    return {
      parsedData: result,
      rawText: JSON.stringify(result, null, 2)
    };
    
  } catch (error: any) {
    console.error("Local OCR Error:", error);
    return {
      parsedData: result,
      rawText: '',
      error: error.message || '로컬 이미지 분석 중 오류가 발생했습니다.'
    };
  }
}
