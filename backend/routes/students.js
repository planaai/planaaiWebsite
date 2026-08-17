const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { getStudentMasterDB } = require('../config/masterDB');

// GET /api/students
router.get('/', (req, res) => {
  try {
    const masterDB = getStudentMasterDB();
    res.json(masterDB.map(s => s.name));
  } catch (error) {
    console.error('Error fetching student names from master DB:', error);
    res.status(500).json({ error: 'Failed to fetch student names' });
  }
});
// GET /api/students/names
router.get('/names', async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      select: { name: true }
    });
    // Return a flat array of student names
    res.json(students.map(s => s.name));
  } catch (error) {
    console.error('Error fetching student names:', error);
    res.status(500).json({ error: 'Failed to fetch student names' });
  }
});

module.exports = router;
