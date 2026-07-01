const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/also1/Documents/ba_archive/ba_archive/planaaiWebsite/frontend/src/components';
const files = [
  'enums/EnumManager.tsx',
  'gifts/GiftsManager.tsx',
  'images/ImageDBManager.tsx',
  'master/EtcSkillCostInput.tsx',
  'master/MasterManager.tsx',
  'ooparts/OopartsManager.tsx',
  'ui/AutoScrollText.tsx',
  'ui/Select.tsx',
  'ui/Toast.tsx'
];

files.forEach(f => {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/import React, \{/g, 'import {');
  content = content.replace(/import React from 'react';\n/g, '');
  if (f === 'images/ImageDBManager.tsx') {
    content = content.replace(/url=\{resourceIcons\.Eleph\}/g, "url={resourceIcons.Eleph || ''}");
    content = content.replace(/url=\{resourceIcons\.SecretTechSheet\}/g, "url={resourceIcons.SecretTechSheet || ''}");
    content = content.replace(/url=\{resourceIcons\.Credit\}/g, "url={resourceIcons.Credit || ''}");
  }
  if (f === 'master/EtcSkillCostInput.tsx') {
    content = content.replace(/  const types = \[\s*\{\s*key: 'BD', label: '전술 교육 BD' \},\s*\{\s*key: 'Note', label: '기술 노트' \},\s*\{\s*key: 'Secret', label: '비의서' \}\s*\];\n/g, '');
  }
  fs.writeFileSync(p, content);
});

console.log("Linting errors fixed.");
