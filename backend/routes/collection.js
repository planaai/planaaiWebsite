require('dotenv').config();
const express = require('express');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const collectionService = require('../services/collectionService');

const router = express.Router();

// 내 컬렉션 조회
router.get('/', optionalAuth, async (req, res) => {
  try {
    const data = await collectionService.getMyCollections(req.user ? req.user.id : null);
    res.json({ status: 'success', ...data });
  } catch (error) {
    console.error('Collection fetch error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 컬렉션 동기화 (Upsert 방식)
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const data = await collectionService.syncCollections(req.user.id, req.body?.collections);
    res.json({ status: 'success', ...data });
  } catch (error) {
    console.error('Collection sync error (Outer):', error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || '서버 오류가 발생했습니다.', details: error?.message || String(error) });
  }
});

// UID 기반 공개 컬렉션 조회
router.get('/public/:uid', async (req, res) => {
  try {
    const data = await collectionService.getPublicCollection(req.params.uid);
    res.json({ status: 'success', ...data });
  } catch (error) {
    console.error('Public collection fetch error:', error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 사용자의 모든 컬렉션 삭제
router.delete('/', requireAuth, async (req, res) => {
  try {
    const data = await collectionService.deleteAllCollections(req.user.id);
    res.json({ status: 'success', ...data });
  } catch (error) {
    console.error('Collection delete error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
