const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. /notices/${id}/edit -> /notices/edit?id=${id}
  content = content.replace(/\`\/notices\/\$\{([^}]+)\}\/edit\`/g, '`/notices/edit?id=${$1}`');
  // 2. /tactics/pve/edit/${id} -> /tactics/pve/edit?id=${id}
  content = content.replace(/\`\/tactics\/pve\/edit\/\$\{([^}]+)\}\`/g, '`/tactics/pve/edit?id=${$1}`');
  // 3. /tactics/pvp/edit/${id} -> /tactics/pvp/edit?id=${id}
  content = content.replace(/\`\/tactics\/pvp\/edit\/\$\{([^}]+)\}\`/g, '`/tactics/pvp/edit?id=${$1}`');

  // 4. /student/${id} -> /student/detail?id=${id}
  content = content.replace(/\`\/student\/\$\{([^}]+)\}\`/g, '`/student/detail?id=${$1}`');
  // 5. /archive/student/${id} -> /archive/student/detail?id=${id}
  content = content.replace(/\`\/archive\/student\/\$\{([^}]+)\}\`/g, '`/archive/student/detail?id=${$1}`');
  
  // 6. /notices/${id} -> /notices/detail?id=${id}  (only if it doesn't have /edit)
  content = content.replace(/\`\/notices\/\$\{([^}]+)\}\`/g, '`/notices/detail?id=${$1}`');
  
  // 7. /tactics/pve/${code} -> /tactics/pve/detail?code=${code}
  content = content.replace(/\`\/tactics\/pve\/\$\{([^}]+)\}\`/g, '`/tactics/pve/detail?code=${$1}`');
  // 8. /tactics/pvp/${code} -> /tactics/pvp/detail?code=${code}
  content = content.replace(/\`\/tactics\/pvp\/\$\{([^}]+)\}\`/g, '`/tactics/pvp/detail?code=${$1}`');
  
  // Also replace '/notices/' + id  type of concatenation if they exist
  // We can just rely on the template strings since they are mostly used.
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Updated URLs in:', filePath);
  }
});
