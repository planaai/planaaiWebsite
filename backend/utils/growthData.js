const fs = require('fs');
const path = require('path');

const levelDataPath = path.join(__dirname, '../../data/level_system.txt');
const equipmentDataPath = path.join(__dirname, '../../data/장비_강화_아이템.txt');
const bonusDataPath = path.join(__dirname, '../../data/bonus_system.txt');
const parsedHtmlPath = path.join(__dirname, '../parsed_html_data.json');

let parsedHtmlData = null;

// Parse level system
function parseLevelSystem() {
  const content = fs.readFileSync(levelDataPath, 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  
  const reports = {};
  const expTable = {};
  
  for (const line of lines) {
    if (line.includes('보고서')) {
      const [namePart, valPart] = line.split(':').map(s => s.trim());
      const [exp, creditStr] = valPart.split('||').map(s => s.trim());
      reports[namePart] = {
        exp: parseInt(exp),
        credit: parseInt(creditStr.replace(/[^0-9]/g, ''))
      };
    } else if (line.startsWith('Lv')) {
      const [lvStr, expStr] = line.split(':').map(s => s.trim());
      const lv = parseInt(lvStr.replace('Lv', ''));
      expTable[lv] = parseInt(expStr);
    }
  }
  return { reports, expTable };
}

// Parse equipment stones
function parseEquipmentSystem() {
  if (!fs.existsSync(equipmentDataPath)) return null;
  const content = fs.readFileSync(equipmentDataPath, 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  const equipmentStones = {};
  for (const line of lines) {
    const [name, expStr] = line.split(':').map(s => s.trim());
    if (name && expStr) {
      equipmentStones[name] = parseInt(expStr);
    }
  }
  return equipmentStones;
}

// Load parsed HTML data
function getParsedHtmlData() {
  if (parsedHtmlData) return parsedHtmlData;
  if (fs.existsSync(parsedHtmlPath)) {
    parsedHtmlData = JSON.parse(fs.readFileSync(parsedHtmlPath, 'utf8'));
    return parsedHtmlData;
  }
  return { equipExp: {}, equipTier: {}, weaponExp: {}, weaponStar: {} };
}

// Load Ability Liberation
function getAbilityLiberationData() {
  // We use the 0~5 format, essentially each level requires exactly:
  // Level 1: 10 basic, 2 WB
  // Level 2: 10 basic, 2 WB
  // Level 3: 10 basic, 2 WB ... up to 5.
  // Actually, the text says:
  // 0~5 기초 메인 오파츠 10개 교양 체육 WB 2개
  // 5~10 기초 메인 오파츠 15개 교양 체육 WB 2개
  // Wait, the text has 5~10, 11~15, 16~20, 21~25
  // We'll just return a function that returns cost per level
  return (level) => {
    if (level >= 1 && level <= 5) return { oopartTier: '기초', oopartCount: 10, wbCount: 2 };
    if (level >= 6 && level <= 10) return { oopartTier: '기초', oopartCount: 15, wbCount: 2 };
    if (level >= 11 && level <= 15) return { oopartTier: '기초', oopartCount: 20, wbCount: 2 };
    if (level >= 16 && level <= 20) return { oopartTier: '일반', oopartCount: 6, wbCount: 4 };
    if (level >= 21 && level <= 25) return { oopartTier: '일반', oopartCount: 8, wbCount: 4 };
    return { oopartTier: '기초', oopartCount: 0, wbCount: 0 };
  };
}

module.exports = {
  getLevelData: () => {
    try { return parseLevelSystem(); } catch (e) { return { reports: {}, expTable: {} }; }
  },
  getEquipmentData: () => {
    try { return parseEquipmentSystem(); } catch (e) { return {}; }
  },
  getHtmlData: getParsedHtmlData,
  getAbilityData: getAbilityLiberationData
};
