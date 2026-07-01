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
  
  // Replace `${master.portraitUrl}` with `https://api.planaai.kro.kr${master.portraitUrl}`
  // But wait, the previous code was `${master.portraitUrl}`, wait, it was `${process.env.NEXT_PUBLIC_API_URL || ''}${master.portraitUrl}`
  // Since we replaced it with nothing, it's now just `${master.portraitUrl}` or `${schema.resourceIcons...}`
  
  // To safely add the domain, we can replace src={`${ with src={`https://api.planaai.kro.kr${
  content = content.replace(/src=\{\`\$\{/g, "src={`https://api.planaai.kro.kr${");
  content = content.replace(/src=\{\`uploads\//g, "src={`https://api.planaai.kro.kr/uploads/");
  
  if (content !== original) {
    fs.writeFileSync(f, content);
    changed++;
  }
});
console.log(`Updated ${changed} files.`);
