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
  let original = content;
  
  if (f.endsWith('api.ts')) {
    content = content.replace(
      /export const API_BASE = .*/g,
      "export const API_BASE = typeof window !== 'undefined' ? '/api' : 'http://140.245.70.15/api';"
    );
  }
  
  // Remove process.env.NEXT_PUBLIC_API_URL entirely for images
  content = content.replace(/\$\{process\.env\.NEXT_PUBLIC_API_URL \|\| ''\}/g, '');
  
  if (content !== original) {
    fs.writeFileSync(f, content);
    changed++;
  }
});
console.log(`Updated ${changed} files.`);
