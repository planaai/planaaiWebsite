const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const clientSrcDir = 'c:/Users/also1/Documents/ba_archive/ba_archive/planaaiWebsite/client/src';
const files = walk(clientSrcDir);

let changed = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes("process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'")) {
    content = content.replace(/process\.env\.NEXT_PUBLIC_API_URL \|\| 'http:\/\/localhost:3000'/g, "process.env.NEXT_PUBLIC_API_URL || ''");
    fs.writeFileSync(f, content);
    changed++;
  }
});
console.log(`Updated ${changed} files.`);
