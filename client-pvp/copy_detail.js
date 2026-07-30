const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('../client/src/app/raids/[code]');
const destDir = path.resolve('src/app/pvp/[code]');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(path.join(srcDir, 'page.tsx'), path.join(destDir, 'page.tsx'));
console.log('Copied page.tsx successfully.');
