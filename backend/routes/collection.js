require('dotenv').config();
const express = require('express');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { prisma } = require('../db');

const router = express.Router();

// 내 컬렉션 조회
router.get('/', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ status: 'success', collections: [], lastSyncTime: null });
    }
    const collections = await prisma.collection.findMany({
      where: { userId: req.user.id }
    });
    
    // 마지막 동기화 일시 계산 (가장 최근의 updatedAt)
    const lastSyncTime = collections.length > 0 
      ? new Date(Math.max(...collections.map(c => new Date(c.updatedAt).getTime()))).toISOString()
      : null;

    res.json({ status: 'success', collections, lastSyncTime });
  } catch (error) {
    console.error('Collection fetch error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 컬렉션 동기화 (Upsert 방식)
router.post('/sync', requireAuth, async (req, res) => {
  const { collections } = req.body; // 배열 형태로 전달
  if (!Array.isArray(collections)) {
    return res.status(400).json({ error: 'collections 배열이 필요합니다.' });
  }

  try {
    const userId = req.user.id;
    const results = [];

    for (const item of collections) {
      let { studentId, starGrade, isOwned } = item;
      if (!studentId) continue;
      
      studentId = parseInt(studentId, 10);
      if (isNaN(studentId)) continue;
      
      starGrade = starGrade !== undefined ? parseInt(starGrade, 10) : undefined;

      try {
        const record = await prisma.collection.upsert({
          where: {
            userId_studentId: {
              userId,
              studentId
            }
          },
          update: {
            starGrade: starGrade !== undefined ? starGrade : undefined,
            isOwned: isOwned !== undefined ? isOwned : undefined,
            details: item
          },
          create: {
            userId,
            studentId,
            starGrade: starGrade || 3,
            isOwned: isOwned !== undefined ? isOwned : true,
            details: item
          }
        });
        results.push(record);
      } catch (err) {
        console.warn(`Failed to sync student ${studentId} for user ${userId}:`, err.message);
      }
    }

    const lastSyncTime = new Date().toISOString();
    res.json({ status: 'success', syncedCount: results.length, lastSyncTime });
  } catch (error) {
    console.error('Collection sync error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// UID 기반 공개 컬렉션 조회
router.get('/public/:uid', async (req, res) => {
  const uid = parseInt(req.params.uid, 10);
  if (isNaN(uid)) {
    return res.status(400).json({ error: '유효하지 않은 UID입니다.' });
  }

  try {
    // uid를 가진 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { uid }
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 해당 사용자의 컬렉션 가져오기 (학생 정보 포함)
    const collections = await prisma.collection.findMany({
      where: { userId: user.id },
      include: {
        student: true // 학생의 세부 정보까지 모두 가져옴
      }
    });

    res.json({
      status: 'success',
      username: user.username,
      uid: user.uid,
      collections
    });
  } catch (error) {
    console.error('Public collection fetch error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자의 모든 컬렉션 삭제
router.delete('/', requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.collection.deleteMany({
      where: { userId: req.user.id }
    });
    res.json({ status: 'success', deletedCount: deleted.count });
  } catch (error) {
    console.error('Collection delete error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
