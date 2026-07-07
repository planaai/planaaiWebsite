const fs = require('fs');
const path = require('path');

const masterFile = path.join(__dirname, 'data', 'plana_mapped.json');
try {
  let data = JSON.parse(fs.readFileSync(masterFile, 'utf8'));

  let updated = 0;
  data.forEach(student => {
    let changed = false;

    // 1. Migrate skills
    if (student.skills && !Array.isArray(student.skills)) {
      student.skills = [student.skills];
      changed = true;
    }

    // 2. Migrate portraitUrls
    if (!student.portraitUrls || student.portraitUrls.length === 0) {
      const urls = [];
      if (student.portraitUrl) urls.push(student.portraitUrl);
      if (student.fullIllustUrl) urls.push(student.fullIllustUrl);
      else if (student.secondaryPortraitUrl) urls.push(student.secondaryPortraitUrl);
      
      if (urls.length > 0) {
        student.portraitUrls = urls;
        changed = true;
      }
    }
    
    if (changed) updated++;
  });

  fs.writeFileSync(masterFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Successfully migrated ${updated} students.`);
} catch (e) {
  console.error("Migration failed:", e);
}
