const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');
const { verifyRecaptcha } = require('../utils/recaptcha');
const uploadPvp = require('../middleware/uploadRaid'); // 재사용 가능
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// GET /api/pvp/parties - Fetch shared parties
router.get('/parties', optionalAuth, async (req, res) => {
  try {
    const { deckType, q, sort } = req.query;
    
    const whereClause = {};
    if (deckType) whereClause.deckType = deckType;

    if (q) {
      whereClause.OR = [
        { name: { contains: q } },
        { shortCode: { contains: q } }
      ];
    }

    let orderBy = { createdAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { likeCount: 'desc' };
    }

    const partiesData = await prisma.sharedPvpParty.findMany({
      where: whereClause,
      include: {
        User: {
          select: { id: true, nickname: true, username: true }
        }
      },
      orderBy,
      take: 50
    });

    const parties = partiesData.map(p => {
      const { User, ...rest } = p;
      return { ...rest, author: User };
    });

    if (req.user && req.user.id && parties.length > 0) {
      try {
        const likedParties = await prisma.sharedPvpPartyLike.findMany({
          where: {
            userId: req.user.id,
            partyId: { in: parties.map(p => p.id) }
          }
        });
        const likedPartyIds = new Set(likedParties.map(l => l.partyId));
        parties.forEach(p => { p.isLiked = likedPartyIds.has(p.id); });
      } catch (likeErr) {
        console.error('Error fetching like status:', likeErr);
        parties.forEach(p => { p.isLiked = false; });
      }
    } else {
      parties.forEach(p => { p.isLiked = false; });
    }

    res.json(parties);
  } catch (error) {
    console.error('Error fetching pvp parties:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// POST /api/pvp/parties - Create a new shared party
router.post('/parties', requireAuth, uploadPvp.single('image'), async (req, res) => {
  try {
    const { name, party: subParty, deckType, tags, tactics, strategyCode, youtubeUrls } = req.body;
    const authorId = req.user.id;

    if (!name || !subParty || !deckType) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    let parsedParty;
    let parsedTags;
    let parsedYoutubeUrls = [];
    try {
      parsedParty = JSON.parse(subParty);
      parsedTags = tags ? JSON.parse(tags) : [];
      if (youtubeUrls) {
        parsedYoutubeUrls = JSON.parse(youtubeUrls);
      }
    } catch (e) {
      return res.status(400).json({ error: '데이터 형식이 잘못되었습니다.' });
    }

    const imagePath = req.file ? '/uploads/raids/' + req.file.filename : null;
    const shortCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const newParty = await prisma.sharedPvpParty.create({
      data: {
        shortCode,
        deckType,
        name,
        party: parsedParty,
        tags: parsedTags,
        tactics: tactics || '',
        strategyCode: strategyCode || null,
        imagePath,
        youtubeUrls: parsedYoutubeUrls.length > 0 ? parsedYoutubeUrls : null,
        authorId
      }
    });

    res.status(201).json(newParty);
  } catch (error) {
    console.error('Error creating pvp party:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// GET /api/pvp/parties/code/:code - Get single party by short code
router.get('/parties/code/:code', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    
    const whereClause = [{ shortCode: code }];
    if (!isNaN(parseInt(code))) {
      whereClause.push({ id: parseInt(code) });
    }

    const partyData = await prisma.sharedPvpParty.findFirst({
      where: { OR: whereClause },
      include: {
        User: {
          select: { id: true, nickname: true, username: true }
        }
      }
    });

    if (!partyData) {
      return res.status(404).json({ error: '조합을 찾을 수 없습니다.' });
    }

    const { User, ...rest } = partyData;
    const party = { ...rest, author: User };

    if (req.user) {
      const like = await prisma.sharedPvpPartyLike.findUnique({
        where: { userId_partyId: { userId: req.user.id, partyId: party.id } }
      });
      party.isLiked = !!like;
    } else {
      party.isLiked = false;
    }

    res.json(party);
  } catch (error) {
    console.error('Error fetching pvp party by code:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// DELETE /api/pvp/parties/:id
router.delete('/parties/:id', requireAuth, async (req, res) => {
  try {
    const partyId = parseInt(req.params.id);
    const party = await prisma.sharedPvpParty.findUnique({ where: { id: partyId } });

    if (!party) return res.status(404).json({ error: '조합을 찾을 수 없습니다.' });
    if (req.user.role !== 'ADMIN' && party.authorId !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    await prisma.sharedPvpParty.delete({ where: { id: partyId } });

    if (party.imagePath) {
      try {
        const fullPath = path.join(__dirname, '..', party.imagePath);
        await fs.unlink(fullPath);
      } catch (err) {}
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pvp party:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// POST /api/pvp/parties/:id/like
router.post('/parties/:id/like', requireAuth, async (req, res) => {
  try {
    const partyId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.isShadowBanned) return res.json({ success: true, fake: true });

    const existingLike = await prisma.sharedPvpPartyLike.findUnique({
      where: { userId_partyId: { userId: user.id, partyId } }
    });

    if (existingLike) {
      await prisma.$transaction([
        prisma.sharedPvpPartyLike.delete({ where: { id: existingLike.id } }),
        prisma.sharedPvpParty.update({ where: { id: partyId }, data: { likeCount: { decrement: 1 } } })
      ]);
      res.json({ success: true, liked: false });
    } else {
      await prisma.$transaction([
        prisma.sharedPvpPartyLike.create({
          data: { userId: user.id, partyId }
        }),
        prisma.sharedPvpParty.update({ where: { id: partyId }, data: { likeCount: { increment: 1 } } })
      ]);
      res.json({ success: true, liked: true });
    }
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// POST /api/pvp/parties/:id/reports - Report a shared party
router.post('/parties/:id/reports', requireAuth, async (req, res) => {
  try {
    const partyId = parseInt(req.params.id);
    if (isNaN(partyId)) {
      return res.status(400).json({ error: '잘못된 파티 ID 입니다.' });
    }

    const { reason, description } = req.body;
    if (!reason) {
      return res.status(400).json({ error: '신고 사유를 선택해주세요.' });
    }

    const party = await prisma.sharedPvpParty.findUnique({
      where: { id: partyId }
    });

    if (!party) {
      return res.status(404).json({ error: '공략을 찾을 수 없습니다.' });
    }

    if (party.authorId === req.user.id) {
      return res.status(400).json({ error: '본인의 공략은 신고할 수 없습니다.' });
    }

    // 중복 신고 체크
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: req.user.id,
        reportedPvpPartyId: partyId
      }
    });

    if (existingReport) {
      return res.status(400).json({ error: '이미 해당 공략을 신고하셨습니다.' });
    }

    await prisma.$transaction(async (tx) => {
      // 신고 레코드 생성
      await tx.report.create({
        data: {
          reporterId: req.user.id,
          reportedPvpPartyId: partyId,
          reportedUserId: party.authorId,
          reason,
          description: description || null
        }
      });

      // 공략의 신고 횟수 증가
      const updatedParty = await tx.sharedPvpParty.update({
        where: { id: partyId },
        data: { reportCount: { increment: 1 } }
      });

      // 5회 이상 신고된 경우 자동 블라인드 처리
      if (updatedParty.reportCount >= 5 && !updatedParty.isBlinded) {
        await tx.sharedPvpParty.update({
          where: { id: partyId },
          data: { isBlinded: true }
        });
      }
    });

    res.json({ success: true, message: '신고가 접수되었습니다.' });
  } catch (error) {
    console.error('Error reporting pvp party:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

module.exports = router;
