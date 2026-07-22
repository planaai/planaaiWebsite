const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const uploadRaid = require('../middleware/uploadRaid');

// GET /api/raids/parties - Fetch shared parties
router.get('/parties', async (req, res) => {
  try {
    const { bossId, terrain, difficulty } = req.query;
    
    const whereClause = {};
    if (bossId) whereClause.bossId = bossId;
    if (terrain) whereClause.terrain = terrain;
    if (difficulty) whereClause.difficulty = difficulty;

    const parties = await prisma.sharedRaidParty.findMany({
      where: whereClause,
      include: {
        author: {
          select: { id: true, nickname: true, username: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Limit for now
    });

    res.json(parties);
  } catch (error) {
    console.error('Error fetching raid parties:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// POST /api/raids/parties - Create a new shared party
router.post('/parties', requireAuth, uploadRaid.single('image'), async (req, res) => {
  try {
    const { bossId, terrain, difficulty, name, parties, tags, tactics, clearTime } = req.body;
    const authorId = req.user.id;

    if (!bossId || !terrain || !difficulty || !name || !parties) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '이미지 첨부는 필수입니다.' });
    }

    let parsedParties;
    let parsedTags;
    try {
      parsedParties = JSON.parse(parties);
      parsedTags = tags ? JSON.parse(tags) : [];
    } catch (e) {
      return res.status(400).json({ error: '데이터 형식이 잘못되었습니다.' });
    }

    const imagePath = '/uploads/raids/' + req.file.filename;

    const newParty = await prisma.sharedRaidParty.create({
      data: {
        bossId,
        terrain,
        difficulty,
        name,
        parties: parsedParties,
        tags: parsedTags,
        tactics: tactics || '',
        clearTime: clearTime || null,
        imagePath,
        authorId
      }
    });

    res.status(201).json(newParty);
  } catch (error) {
    console.error('Error creating raid party:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

module.exports = router;
