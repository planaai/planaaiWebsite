const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./client/src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Replace string literals: 'http://localhost:3000/...' or "http://localhost:3000/..."
    if (content.includes("'http://localhost:3000")) {
      content = content.replace(/'http:\/\/localhost:3000([^']*)'/g, "`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}$1`");
      changed = true;
    }
    if (content.includes('"http://localhost:3000')) {
      content = content.replace(/"http:\/\/localhost:3000([^"]*)"/g, "`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}$1`");
      changed = true;
    }
    
    // Replace within template literals: `http://localhost:3000...`
    if (content.includes("`http://localhost:3000")) {
      content = content.replace(/`http:\/\/localhost:3000/g, "`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/");
      // Fix potential double slashes like 'http://localhost:3000//'
      content = content.replace(/\$\{process\.env\.NEXT_PUBLIC_API_URL \|\| 'http:\/\/localhost:3000'\}\/\//g, "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/");
      changed = true;
    }
    
    // There is one specific fix: if the template literal was `http://localhost:3000${some_var}` 
    // it became `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/${some_var}` which is fine if some_var starts with a slash, we might end up with `...//...`. 
    // But `http://localhost:3000${master.portraitUrl}` usually has portraitUrl start with slash. Let's just strip trailing slash from localhost:3000 replacement.
    if (content.includes("`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/")) {
         content = content.replace(/`\$\{process\.env\.NEXT_PUBLIC_API_URL \|\| 'http:\/\/localhost:3000'\}\//g, "`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}");
    }

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log('Updated', filePath);
    }
  }
});
