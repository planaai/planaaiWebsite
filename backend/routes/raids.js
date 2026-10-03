const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');
const uploadRaid = require('../middleware/uploadRaid');
const raidService = require('../services/raidService');

// GET /api/raids/meta - Fetch bosses and seasons
router.get('/meta', async (req, res) => {
  try {
    const meta = await raidService.getMeta();
    res.json(meta);
  } catch (error) {
    console.error('Error fetching raid meta:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// GET /api/raids/youtube-meta - Fetch YouTube metadata
router.get('/youtube-meta', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const meta = await raidService.getYoutubeMeta(url);
    res.json(meta);
  } catch (error) {
    console.error('Error fetching YouTube meta:', error);
    res.status(500).json({ error: error.message || '유튜브 정보를 가져오는 데 실패했습니다.' });
  }
});

// POST /api/raids/bosses - Add a new boss (Admin)
router.post('/bosses', requireAdmin, async (req, res) => {
  try {
    const boss = await raidService.createBoss(req.body);
    res.status(201).json(boss);
  } catch (error) {
    console.error('Error creating boss:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// PUT /api/raids/bosses/:id - Update a boss (Admin)
router.put('/bosses/:id', requireAdmin, async (req, res) => {
  try {
    const boss = await raidService.updateBoss(req.params.id, req.body);
    res.json(boss);
  } catch (error) {
    console.error('Error updating boss:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// DELETE /api/raids/bosses/:id - Delete a boss (Admin)
router.delete('/bosses/:id', requireAdmin, async (req, res) => {
  try {
    await raidService.deleteBoss(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting boss:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// POST /api/raids/seasons - Add a new season (Admin)
router.post('/seasons', requireAdmin, async (req, res) => {
  try {
    const result = await raidService.createSeason(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating season:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// POST /api/raids/seasons/sync - Sync all difficulties (Admin)
router.post('/seasons/sync', requireAdmin, async (req, res) => {
  try {
    const result = await raidService.syncSeasons();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error syncing seasons:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// GET /api/raids/parties - Fetch shared parties
router.get('/parties', optionalAuth, async (req, res) => {
  try {
    const parties = await raidService.getParties(req.query, req.user);
    res.json(parties);
  } catch (error) {
    console.error('Error fetching raid parties:', error.message, error.stack);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// POST /api/raids/parties - Create a new shared party
router.post('/parties', requireAuth, uploadRaid.single('image'), async (req, res) => {
  try {
    const newParty = await raidService.createParty(req.body, req.file, req.user.id);
    res.status(201).json(newParty);
  } catch (error) {
    console.error('Error creating raid party:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// PUT /api/raids/parties/:id - Edit an existing raid party
router.put('/parties/:id', requireAuth, uploadRaid.single('image'), async (req, res) => {
  try {
    const updatedParty = await raidService.updateParty(req.params.id, req.body, req.file, req.user);
    res.status(200).json(updatedParty);
  } catch (error) {
    console.error('Error updating raid party:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// GET /api/raids/parties/code/:code - Get single party by short code
router.get('/parties/code/:code', optionalAuth, async (req, res) => {
  try {
    const party = await raidService.getPartyByCode(req.params.code, req.user);
    res.json(party);
  } catch (error) {
    console.error('Error fetching raid party by code:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// DELETE /api/raids/parties/:id - Delete a shared party
router.delete('/parties/:id', requireAuth, async (req, res) => {
  try {
    const result = await raidService.deleteParty(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    console.error('Error deleting raid party:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// POST /api/raids/parties/:id/like - Toggle like on a shared party
router.post('/parties/:id/like', requireAuth, async (req, res) => {
  try {
    const result = await raidService.toggleLike(req.params.id, req.body, req.headers, req.ip || req.connection.remoteAddress, req.user);
    res.json(result);
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// POST /api/raids/parties/:id/reports - Report a shared party
router.post('/parties/:id/reports', requireAuth, async (req, res) => {
  try {
    const result = await raidService.reportParty(req.params.id, req.body, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: error.message || '서버 에러가 발생했습니다.' });
  }
});

// GET /api/raids/admin/reports - 전체 신고 목록 조회
router.get('/admin/reports', requireAdmin, async (req, res) => {
  try {
    const data = await raidService.getReports(req.query);
    res.json(data);
  } catch (error) {
    console.error('Admin GET reports error:', error);
    res.status(500).json({ error: '신고 목록 조회 중 오류가 발생했습니다.' });
  }
});

// PUT /api/raids/admin/reports/:id - 신고 상태 변경 및 제재 적용
router.put('/admin/reports/:id', requireAdmin, async (req, res) => {
  try {
    const result = await raidService.updateReport(req.params.id, req.body, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Admin update report error:', error);
    res.status(500).json({ error: error.message || '신고 처리 중 오류가 발생했습니다.' });
  }
});

// GET /api/raids/admin/banned-ips - 차단된 IP 목록
router.get('/admin/banned-ips', requireAdmin, async (req, res) => {
  try {
    const ips = await raidService.getBannedIps();
    res.json(ips);
  } catch (error) {
    console.error('Admin GET banned IPs error:', error);
    res.status(500).json({ error: 'IP 목록 조회 실패' });
  }
});

// DELETE /api/raids/admin/banned-ips/:id - IP 차단 해제
router.delete('/admin/banned-ips/:id', requireAdmin, async (req, res) => {
  try {
    const result = await raidService.deleteBannedIp(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Admin DELETE banned IP error:', error);
    res.status(500).json({ error: 'IP 차단 해제 실패' });
  }
});

module.exports = router;
