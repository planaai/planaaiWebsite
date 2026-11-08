const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { getStudentMasterDB, setStudentMasterDB, saveMasterDB, syncStudentGiftAffinity } = require('../config/masterDB');
const { requireAdmin } = require('../middleware/auth');

router.get('/students/names', (req, res) => {
  res.json(getStudentMasterDB().map(s => s.name));
});

router.get('/students', (req, res) => res.json(getStudentMasterDB()));

router.post('/students', requireAdmin, (req, res) => {
  const studentMasterDB = getStudentMasterDB();
  
  // Find the maximum ID currently in the DB
  const maxId = studentMasterDB.reduce((max, s) => {
    // only consider safe integer IDs (avoid Date.now() values that might have been added previously)
    return (s.id && s.id < 1000000) ? Math.max(max, s.id) : max;
  }, 0);
  
  const newId = maxId + 1;

  const { preferredGifts, ...studentData } = req.body;
  const newStudent = { ...studentData, id: newId };
  if (!newStudent.skills) newStudent.skills = [{ ex: {}, normal: {}, passive: {}, sub: {} }];
  if (!newStudent.portraitUrls) newStudent.portraitUrls = [];
  studentMasterDB.push(newStudent);
  saveMasterDB();

  let parsedGifts = preferredGifts;
  if (typeof preferredGifts === 'string') {
    try { parsedGifts = JSON.parse(preferredGifts); } catch(e) {}
  }
  if (parsedGifts !== undefined && parsedGifts !== null) {
    syncStudentGiftAffinity(newId, parsedGifts);
  }

  res.json({ status: 'success', student: newStudent });
});

router.put('/students/:id', requireAdmin, (req, res) => {
  const studentId = Number(req.params.id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Invalid student ID' });
  }

  const { preferredGifts, ...studentData } = req.body;
  let studentMasterDB = getStudentMasterDB();
  const exists = studentMasterDB.some(s => s.id === studentId);
  if (!exists) {
    return res.status(404).json({ error: 'Student not found' });
  }

  studentMasterDB = studentMasterDB.map(s => s.id === studentId ? { ...studentData, id: studentId } : s);
  setStudentMasterDB(studentMasterDB);

  let parsedGifts = preferredGifts;
  if (typeof preferredGifts === 'string') {
    try { parsedGifts = JSON.parse(preferredGifts); } catch(e) {}
  }
  if (parsedGifts !== undefined && parsedGifts !== null) {
    syncStudentGiftAffinity(studentId, parsedGifts);
  }

  res.json({ status: 'success' });
});

router.delete('/students/:id', requireAdmin, (req, res) => {
  const studentId = Number(req.params.id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Invalid student ID' });
  }

  let studentMasterDB = getStudentMasterDB();
  studentMasterDB = studentMasterDB.filter(s => s.id !== studentId);
  setStudentMasterDB(studentMasterDB);

  syncStudentGiftAffinity(studentId, { level2: [], level3: [], level4: [] });

  res.json({ status: 'success' });
});

router.all('/students/fix-ids', requireAdmin, (req, res) => {
  const studentMasterDB = getStudentMasterDB();
  let changed = 0;
  
  // Find the maximum valid ID
  let maxId = studentMasterDB.reduce((max, s) => {
    return (s.id && s.id < 1000000) ? Math.max(max, s.id) : max;
  }, 0);
  
  // Fix broken IDs
  studentMasterDB.forEach(s => {
    if (s.id >= 1000000) {
      maxId++;
      s.id = maxId;
      s.studentNumber = maxId;
      changed++;
    }
  });
  
  if (changed > 0) {
    saveMasterDB();
  }
  
  res.json({ status: 'success', fixedCount: changed });
});

router.post('/gacha/update', requireAdmin, (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array is required' });
  }

  // Validate each url
  for (const u of urls) {
    if (typeof u !== 'string' || !/^https?:\/\//i.test(u)) {
      return res.status(400).json({ error: 'Invalid URL format in urls array' });
    }
  }
  
  const scriptPath = path.join(__dirname, '..', 'scripts', 'update_gacha_from_url.js');
  
  execFile('node', [scriptPath, ...urls], { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.error('execFile error:', error);
      return res.status(500).json({ error: 'Failed to update gacha data' });
    }
    // Invalidate cache so next status request shows fresh data
    gachaCache = null;
    gachaCacheTime = 0;
    res.json({ status: 'success', output: stdout });
  });
});


let gachaCache = null;
let gachaCacheTime = 0;
const GACHA_CACHE_TTL = 30000;
const newGachaPath = path.join(__dirname, '..', 'data', 'gacha.json');

router.get('/gacha/status', (req, res) => {
  try {
    const now = Date.now();
    if (!gachaCache || (now - gachaCacheTime > GACHA_CACHE_TTL)) {
      if (fs.existsSync(newGachaPath)) {
        gachaCache = JSON.parse(fs.readFileSync(newGachaPath, 'utf8'));
      } else {
        gachaCache = { urls: [], banners: [], pools: { "3_star": [], "2_star": [], "1_star": [] } };
      }
      gachaCacheTime = now;
    }
    res.json(gachaCache);
  } catch (error) {
    gachaCache = null;
    res.status(500).json({ error: 'Failed to read gacha status' });
  }
});

module.exports = router;
