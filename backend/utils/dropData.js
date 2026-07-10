const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dropDataPath = path.join(__dirname, '../../data/장비드랍표.xlsx');

let cachedDropData = null;

const equipmentKeyMapping = {
  '모자': 'Hat',
  '장갑': 'Gloves',
  '신발': 'Shoes',
  '가방': 'Bag',
  '배지': 'Badge',
  '뱃지': 'Badge',
  '헤어핀': 'Hairpin',
  '부적': 'Charm',
  '시계': 'Watch',
  '목걸이': 'Necklace',
};

function parseDropData() {
  if (cachedDropData) return cachedDropData;
  if (!fs.existsSync(dropDataPath)) return [];

  const wb = xlsx.readFile(dropDataPath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  
  const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  const drops = [];
  
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || !row[0] || !row[1]) continue;
    
    const stage = String(row[0]).trim();
    const dropStr = String(row[1]).trim();
    
    const matches = [...dropStr.matchAll(/(\d+)([^0-9]+)/g)];
    const stageDrops = [];
    
    matches.forEach((match, index) => {
      const tier = parseInt(match[1]);
      const krName = match[2].trim();
      const type = equipmentKeyMapping[krName] || krName;
      
      // 맨 앞에 있는 것이 드랍 확률이 가장 높음 (예: 90%, 67.5%, 67.5%)
      const rate = index === 0 ? 90 : 67.5; 
      
      stageDrops.push({
        tier,
        type,
        rate
      });
    });
    
    drops.push({
      stage,
      drops: stageDrops
    });
  }
  
  cachedDropData = drops;
  return drops;
}

module.exports = {
  getDropData: parseDropData
};
