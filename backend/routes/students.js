const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

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
