const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const errorKeywords = ['실패', '오류', '에러', '않습니다', '없습니다', '해주세요'];

walkDir(srcDir, (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('alert(')) {
    let modified = false;
    
    // Add import for toast if not exists
    if (!content.includes("import { toast } from 'sonner'") && !content.includes('import {toast}')) {
      // Find the last import
      const importMatches = [...content.matchAll(/^import.*$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertPos = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertPos) + "\nimport { toast } from 'sonner';" + content.slice(insertPos);
      } else {
        content = "import { toast } from 'sonner';\n" + content;
      }
      modified = true;
    }

    // Replace alert calls
    // We will use a regex to match alert('...') or alert(`...`) or alert(...)
    const alertRegex = /alert\((.*?)\);?/g;
    content = content.replace(alertRegex, (match, innerArgs) => {
      // If it looks like an error
      if (errorKeywords.some(kw => innerArgs.includes(kw)) || innerArgs.includes('err') || innerArgs.includes('e as Error')) {
        return `toast.error('잠시 후에 다시 시도해 주세요');`;
      } else {
        return `toast.success(${innerArgs});`;
      }
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
});
