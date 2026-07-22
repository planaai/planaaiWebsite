const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const uploadRaid = require('../middleware/uploadRaid');
const crypto = require('crypto');

// GET /api/raids/meta - Fetch bosses and seasons
router.get('/meta', async (req, res) => {
  try {
    const bosses = await prisma.raidBoss.findMany({
      include: {
        seasons: true
      }
    });
    
    // We want to return an object { bosses: [], seasons: [] } to match existing structure somewhat,
    // or just return bosses with nested seasons. But let's return standard arrays.
    const allBosses = bosses.map(b => ({
      id: b.id,
      name: b.name,
      iconUrl: b.iconUrl,
      bannerUrl: b.bannerUrl,
      defenseType: b.defenseType,
      category: b.category
    }));
    
    const allSeasons = bosses.flatMap(b => b.seasons.map(s => ({
      id: s.id,
      bossId: s.bossId,
      terrain: s.terrain,
      difficulty: s.difficulty,
      parties: [] // Legacy compat
    })));

    res.json({ bosses: allBosses, seasons: allSeasons });
  } catch (error) {
    console.error('Error fetching raid meta:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// POST /api/raids/bosses - Add a new boss (Admin)
router.post('/bosses', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    const { id, name, iconUrl, bannerUrl, defenseType, category } = req.body;
    
    const boss = await prisma.raidBoss.create({
      data: { id, name, iconUrl, bannerUrl, defenseType, category: category || 'Assault' }
    });
    res.status(201).json(boss);
  } catch (error) {
    console.error('Error creating boss:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// PUT /api/raids/bosses/:id - Update a boss (Admin)
router.put('/bosses/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    const { name, iconUrl, bannerUrl, defenseType, category } = req.body;
    
    const boss = await prisma.raidBoss.update({
      where: { id: req.params.id },
      data: { name, iconUrl, bannerUrl, defenseType, category: category || 'Assault' }
    });
    res.json(boss);
  } catch (error) {
    console.error('Error updating boss:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// DELETE /api/raids/bosses/:id - Delete a boss (Admin)
router.delete('/bosses/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    
    await prisma.raidBoss.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting boss:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// POST /api/raids/seasons - Add a new season (Admin)
router.post('/seasons', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    const { bossId, terrain } = req.body;
    
    const difficulties = ['Normal', 'Hard', 'VeryHard', 'Hardcore', 'Extreme', 'Insane', 'Torment', 'Lunatic'];
    const dataToInsert = difficulties.map(diff => ({
      bossId,
      terrain,
      difficulty: diff
    }));

    await prisma.raidSeason.createMany({
      data: dataToInsert,
      skipDuplicates: true
    });
    
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error creating season:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// GET /api/raids/parties - Fetch shared parties
router.get('/parties', async (req, res) => {
  try {
    const { bossId, terrain, difficulty, mode } = req.query;
    
    const whereClause = {};
    if (bossId) whereClause.bossId = bossId;
    if (terrain) whereClause.terrain = terrain;
    if (difficulty) whereClause.difficulty = difficulty;
    if (mode) whereClause.mode = mode;

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
    const { name, parties: subParties, bossId, terrain, difficulty, tags, tactics, clearTime, mode } = req.body;
    const authorId = req.user.id;

    // Validate required fields
    if (!name || !subParties || !bossId || !terrain || !difficulty || !mode) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '이미지 첨부는 필수입니다.' });
    }

    let parsedParties;
    let parsedTags;
    try {
      parsedParties = JSON.parse(subParties);
      parsedTags = tags ? JSON.parse(tags) : [];
    } catch (e) {
      return res.status(400).json({ error: '데이터 형식이 잘못되었습니다.' });
    }

    const imagePath = '/uploads/raids/' + req.file.filename;
    const shortCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const newParty = await prisma.sharedRaidParty.create({
      data: {
        shortCode,
        mode,
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

// GET /api/raids/parties/code/:code - Get single party by short code
router.get('/parties/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const whereClause = [{ shortCode: code }];
    if (!isNaN(parseInt(code))) {
      whereClause.push({ id: parseInt(code) });
    }

    const party = await prisma.sharedRaidParty.findFirst({
      where: { 
        OR: whereClause
      },
      include: {
        author: {
          select: { id: true, nickname: true, username: true }
        }
      }
    });

    if (!party) {
      return res.status(404).json({ error: '공략을 찾을 수 없습니다.' });
    }

    res.json(party);
  } catch (error) {
    console.error('Error fetching raid party by code:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// DELETE /api/raids/parties/:id - Delete a shared party (author or admin)
router.delete('/parties/:id', requireAuth, async (req, res) => {
  try {
    const partyId = parseInt(req.params.id);
    if (isNaN(partyId)) {
      return res.status(400).json({ error: '잘못된 파티 ID 입니다.' });
    }

    const party = await prisma.sharedRaidParty.findUnique({
      where: { id: partyId }
    });

    if (!party) {
      return res.status(404).json({ error: '파티를 찾을 수 없습니다.' });
    }

    if (req.user.role !== 'ADMIN' && party.authorId !== req.user.id) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    await prisma.sharedRaidParty.delete({
      where: { id: partyId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting raid party:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

module.exports = router;
