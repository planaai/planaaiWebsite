const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const uploadPvp = require('../middleware/uploadRaid');
const pvpService = require('../services/pvpService');

// GET /api/pvp/parties - Fetch shared parties
router.get('/parties', optionalAuth, async (req, res) => {
  try {
    const parties = await pvpService.getParties(req.query, req.user);
    res.json(parties);
  } catch (error) {
    console.error('Error fetching pvp parties:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// POST /api/pvp/parties - Create a new shared party
router.post('/parties', requireAuth, uploadPvp.single('image'), async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: '요청 본문이 비어있습니다.' });
    }
    const newParty = await pvpService.createParty(req.body, req.file, req.user.id);
    res.status(201).json(newParty);
  } catch (error) {
    console.error('Error creating pvp party:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// GET /api/pvp/parties/code/:code - Get single party by short code
router.get('/parties/code/:code', optionalAuth, async (req, res) => {
  try {
    const party = await pvpService.getPartyByCode(req.params.code, req.user);
    res.json(party);
  } catch (error) {
    console.error('Error fetching pvp party by code:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// PUT /api/pvp/parties/:id - Update an existing shared party
router.put('/parties/:id', requireAuth, uploadPvp.single('image'), async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: '요청 본문이 비어있습니다.' });
    }
    const updatedParty = await pvpService.updateParty(req.params.id, req.body, req.file, req.user);
    res.json(updatedParty);
  } catch (error) {
    console.error('Error updating pvp party:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// DELETE /api/pvp/parties/:id
router.delete('/parties/:id', requireAuth, async (req, res) => {
  try {
    const result = await pvpService.deleteParty(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    console.error('Error deleting pvp party:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// POST /api/pvp/parties/:id/like
router.post('/parties/:id/like', requireAuth, async (req, res) => {
  try {
    const result = await pvpService.toggleLike(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// POST /api/pvp/parties/:id/reports - Report a shared party
router.post('/parties/:id/reports', requireAuth, async (req, res) => {
  try {
    const result = await pvpService.reportParty(req.params.id, req.body, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error reporting pvp party:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

module.exports = router;
