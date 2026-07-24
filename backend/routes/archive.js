const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { getSchemaConfig, getStudentMasterDB } = require('../config/masterDB');

router.get('/', optionalAuth, async (req, res) => {
  try {
    const schemaConfig = getSchemaConfig();
    const studentMasterDB = getStudentMasterDB();
    const requiredFields = schemaConfig.statFields.filter(f => f.required).map(f => f.key);
    
    // Fetch collections from Prisma instead of memory
    const collections = req.user ? await prisma.collection.findMany({
      where: { userId: req.user.id }
    }) : [];
    
    const userArchiveMap = new Map();
    collections.forEach(c => {
      if (c.details) {
        userArchiveMap.set(c.studentId, { ...c.details, studentId: c.studentId, currentStars: c.starGrade });
      } else {
        userArchiveMap.set(c.studentId, { studentId: c.studentId, currentStars: c.starGrade });
      }
    });

    const result = studentMasterDB.map(master => {
      const archive = userArchiveMap.get(master.id);
      let isMissing = false; let missingMessages = [];
      if (!archive || !archive.stats) { isMissing = true; missingMessages.push('스크린샷 캡쳐(기록)가 없습니다.'); } else {
        const missingKeys = requiredFields.filter(key => archive.stats[key] === null || archive.stats[key] === undefined);
        if (missingKeys.length > 0) {
          isMissing = true;
          const labels = missingKeys.map(k => schemaConfig.statFields.find(f => f.key === k)?.label || k);
          missingMessages.push(`${labels.join(', ')} 수치가 캡쳐되지 않았습니다.`);
        }
      }
      return { master, archive: archive || null, warning: isMissing ? { message: missingMessages.join(' ') } : null };
    });
    result.sort((a, b) => a.master.name.localeCompare(b.master.name, 'ko-KR'));
    res.json({ totalStudents: studentMasterDB.length, archivedCount: collections.length, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch archive' });
  }
});

module.exports = router;
