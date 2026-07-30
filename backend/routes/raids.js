const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');
const { verifyRecaptcha } = require('../utils/recaptcha');
const uploadRaid = require('../middleware/uploadRaid');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

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

// GET /api/raids/youtube-meta - Fetch YouTube metadata
router.get('/youtube-meta', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    
    res.json({
      title: data.title || '',
      channel: data.author_name || ''
    });
  } catch (error) {
    console.error('Error fetching YouTube meta:', error);
    res.status(500).json({ error: '유튜브 정보를 가져오는 데 실패했습니다.' });
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

// POST /api/raids/seasons/sync - Sync all difficulties for all existing bosses/terrains (Admin)
router.post('/seasons/sync', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    
    // Find all unique (bossId, terrain) combinations currently existing
    const existingSeasons = await prisma.raidSeason.findMany({
      select: {
        bossId: true,
        terrain: true
      },
      distinct: ['bossId', 'terrain']
    });

    const difficulties = ['Normal', 'Hard', 'VeryHard', 'Hardcore', 'Extreme', 'Insane', 'Torment', 'Lunatic'];
    const dataToInsert = [];

    for (const s of existingSeasons) {
      for (const diff of difficulties) {
        dataToInsert.push({
          bossId: s.bossId,
          terrain: s.terrain,
          difficulty: diff
        });
      }
    }

    // Insert all, skipping duplicates via the composite unique key
    await prisma.raidSeason.createMany({
      data: dataToInsert,
      skipDuplicates: true
    });
    
    res.status(200).json({ success: true, message: '모든 보스 난이도 동기화 완료' });
  } catch (error) {
    console.error('Error syncing seasons:', error);
    res.status(500).json({ error: '서버 에러' });
  }
});

// GET /api/raids/parties - Fetch shared parties
router.get('/parties', optionalAuth, async (req, res) => {
  try {
    const { bossId, terrain, difficulty, mode, q, sort, filters } = req.query;
    
    const whereClause = { isBlinded: false };
    if (mode) whereClause.mode = mode;

    if (q) {
      whereClause.OR = [
        { name: { contains: q } },
        { shortCode: { contains: q } }
      ];
    }

    if (filters) {
      try {
        const parsedFilters = JSON.parse(filters);
        if (Array.isArray(parsedFilters) && parsedFilters.length > 0) {
          const filterConditions = parsedFilters.map(f => {
            const cond = { bossId: f.bossId };
            if (f.terrain) cond.terrain = f.terrain;
            if (f.difficulty) {
              if (typeof f.difficulty === 'string' && f.difficulty.includes('-')) {
                const [minStr, maxStr] = f.difficulty.split('-');
                const min = parseInt(minStr, 10);
                const max = parseInt(maxStr, 10);
                if (!isNaN(min) && !isNaN(max)) {
                  const validDifficulties = [];
                  for (let i = min; i <= max; i++) {
                    validDifficulties.push(i.toString());
                  }
                  cond.difficulty = { in: validDifficulties };
                } else {
                  cond.difficulty = f.difficulty;
                }
              } else {
                cond.difficulty = f.difficulty;
              }
            }
            return cond;
          });
          
          if (whereClause.OR) {
             whereClause.AND = [{ OR: filterConditions }, { OR: whereClause.OR }];
             delete whereClause.OR;
          } else {
             whereClause.OR = filterConditions;
          }
        }
      } catch (e) {
        console.error("Invalid filters format", e);
      }
    } else {
      // Fallback for legacy requests without filters
      if (bossId) {
        const bossIds = bossId.split(',');
        if (bossIds.length > 1) {
          whereClause.bossId = { in: bossIds };
        } else {
          whereClause.bossId = bossId;
        }
      }
      if (terrain) whereClause.terrain = terrain;
      if (difficulty) whereClause.difficulty = difficulty;
    }

    let orderBy = { createdAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { likeCount: 'desc' };
    }

    const parties = await prisma.sharedRaidParty.findMany({
      where: whereClause,
      include: {
        author: {
          select: { id: true, nickname: true, username: true }
        }
      },
      orderBy,
      take: 50 // Limit for now
    });

    if (req.user && req.user.id && parties.length > 0) {
      try {
        const likedParties = await prisma.sharedRaidPartyLike.findMany({
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
    console.error('Error fetching raid parties:', error.message, error.stack);
    console.error('Query params:', req.query);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// POST /api/raids/parties - Create a new shared party
router.post('/parties', requireAuth, uploadRaid.single('image'), async (req, res) => {
  try {
    const { name, parties: subParties, bossId, terrain, difficulty, tags, tactics, clearTime, mode, youtubeUrls } = req.body;
    const authorId = req.user.id;

    // Validate required fields
    const missingFields = [];
    if (!name) missingFields.push('이름');
    if (!subParties) missingFields.push('사용 부대(파티)');
    if (!bossId) missingFields.push('보스');
    if (!terrain) missingFields.push('지형');
    if (!difficulty) missingFields.push('난이도');
    if (!mode) missingFields.push('분류(모드)');

    if (missingFields.length > 0) {
      return res.status(400).json({ error: `필수 항목이 누락되었습니다: ${missingFields.join(', ')}` });
    }

    if (!req.file) {
      return res.status(400).json({ error: '이미지 첨부는 필수입니다.' });
    }

    let parsedParties;
    let parsedTags;
    let parsedYoutubeUrls = [];
    try {
      parsedParties = JSON.parse(subParties);
      parsedTags = tags ? JSON.parse(tags) : [];
      if (youtubeUrls) {
        parsedYoutubeUrls = JSON.parse(youtubeUrls);
        if (!Array.isArray(parsedYoutubeUrls) || parsedYoutubeUrls.length > 5) {
          return res.status(400).json({ error: '유튜브 링크는 최대 5개까지 등록할 수 있습니다.' });
        }
        // Validate each URL (long-form only)
        const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
        for (const video of parsedYoutubeUrls) {
          if (!video.url) {
            return res.status(400).json({ error: '유튜브 URL을 입력해주세요.' });
          }
          if (!youtubeRegex.test(video.url.trim())) {
            return res.status(400).json({ error: '유효하지 않은 YouTube 롱폼 영상 URL이 포함되어 있습니다. (Shorts 불가)' });
          }
        }
      }
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
        youtubeUrls: parsedYoutubeUrls.length > 0 ? parsedYoutubeUrls : null,
        authorId
      }
    });

    res.status(201).json(newParty);
  } catch (error) {
    console.error('Error creating raid party:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// PUT /api/raids/parties/:id - Edit an existing raid party
router.put('/parties/:id', requireAuth, uploadRaid.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const authorId = req.user.id;
    const userRole = req.user.role;
    const { mode, name, bossId, terrain, difficulty, tags, tactics, clearTime, parties: subParties, youtubeUrls } = req.body;

    const existingParty = await prisma.sharedRaidParty.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingParty) {
      return res.status(404).json({ error: '공략을 찾을 수 없습니다.' });
    }

    if (existingParty.authorId !== authorId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: '공략을 수정할 권한이 없습니다.' });
    }

    let parsedParties;
    let parsedTags;
    let parsedYoutubeUrls = [];
    try {
      parsedParties = subParties ? JSON.parse(subParties) : existingParty.parties;
      parsedTags = tags ? JSON.parse(tags) : existingParty.tags;
      if (youtubeUrls) {
        parsedYoutubeUrls = JSON.parse(youtubeUrls);
        if (!Array.isArray(parsedYoutubeUrls) || parsedYoutubeUrls.length > 5) {
          return res.status(400).json({ error: '유튜브 링크는 최대 5개까지 등록할 수 있습니다.' });
        }
        const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
        for (const video of parsedYoutubeUrls) {
          if (!video.url) {
            return res.status(400).json({ error: '유튜브 URL을 입력해주세요.' });
          }
          if (!youtubeRegex.test(video.url.trim())) {
            return res.status(400).json({ error: '유효하지 않은 YouTube 롱폼 영상 URL이 포함되어 있습니다. (Shorts 불가)' });
          }
        }
      } else {
        parsedYoutubeUrls = existingParty.youtubeUrls;
      }
    } catch (e) {
      return res.status(400).json({ error: '데이터 형식이 잘못되었습니다.' });
    }

    const imagePath = req.file ? '/uploads/raids/' + req.file.filename : existingParty.imagePath;

    const updatedParty = await prisma.sharedRaidParty.update({
      where: { id: parseInt(id) },
      data: {
        mode: mode || existingParty.mode,
        bossId: bossId || existingParty.bossId,
        terrain: terrain || existingParty.terrain,
        difficulty: difficulty || existingParty.difficulty,
        name: name !== undefined ? name : existingParty.name,
        parties: parsedParties,
        tags: parsedTags,
        tactics: tactics !== undefined ? tactics : existingParty.tactics,
        clearTime: clearTime !== undefined ? clearTime : existingParty.clearTime,
        imagePath,
        youtubeUrls: parsedYoutubeUrls && parsedYoutubeUrls.length > 0 ? parsedYoutubeUrls : null,
      }
    });

    res.status(200).json(updatedParty);
  } catch (error) {
    console.error('Error updating raid party:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});
// GET /api/raids/parties/code/:code - Get single party by short code
router.get('/parties/code/:code', optionalAuth, async (req, res) => {
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

    if (req.user) {
      const like = await prisma.sharedRaidPartyLike.findUnique({
        where: { userId_partyId: { userId: req.user.id, partyId: party.id } }
      });
      party.isLiked = !!like;
    } else {
      party.isLiked = false;
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

    // Delete image file, log error but proceed if fails
    if (party.imagePath) {
      try {
        const fullPath = path.join(__dirname, '..', party.imagePath);
        await fs.unlink(fullPath);
      } catch (err) {
        console.error(`Failed to delete image file: ${party.imagePath}`, err);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting raid party:', error);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

// POST /api/raids/parties/:id/like - Toggle like on a shared party
router.post('/parties/:id/like', requireAuth, async (req, res) => {
  try {
    const partyId = parseInt(req.params.id);
    if (isNaN(partyId)) {
      return res.status(400).json({ error: '잘못된 파티 ID 입니다.' });
    }
    
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.isShadowBanned) {
      return res.json({ success: true, fake: true });
    }

    const existingLike = await prisma.sharedRaidPartyLike.findUnique({
      where: { userId_partyId: { userId: user.id, partyId } }
    });

    if (!existingLike) {
      const { turnstileToken } = req.body;
      const isHuman = await verifyRecaptcha(turnstileToken);
      if (!isHuman) {
        return res.status(403).json({ error: '비정상적인 접근입니다. (보안 인증 실패)' });
      }
    }

    const deviceFp = req.headers['x-device-fingerprint'] || null;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // 어뷰징 조건: 생성 24시간 내 + 같은 기기에서 3개 이상 계정으로 누른 경우
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (!existingLike && user.createdAt > oneDayAgo && deviceFp) {
      const usersOnDevice = await prisma.sharedRaidPartyLike.findMany({
        where: { deviceFp },
        select: { userId: true },
        distinct: ['userId']
      });
      if (usersOnDevice.length >= 3) {
        await prisma.user.update({ where: { id: user.id }, data: { isShadowBanned: true } });
        return res.json({ success: true, fake: true });
      }
    }

    if (existingLike) {
      // 취소
      await prisma.$transaction([
        prisma.sharedRaidPartyLike.delete({ where: { id: existingLike.id } }),
        prisma.sharedRaidParty.update({ where: { id: partyId }, data: { likeCount: { decrement: 1 } } })
      ]);
      res.json({ success: true, liked: false });
    } else {
      // 추천
      await prisma.$transaction([
        prisma.sharedRaidPartyLike.create({
          data: { userId: user.id, partyId, deviceFp, ipAddress }
        }),
        prisma.sharedRaidParty.update({ where: { id: partyId }, data: { likeCount: { increment: 1 } } })
      ]);
      res.json({ success: true, liked: true });
    }
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});
// POST /api/raids/parties/:id/reports - Report a shared party
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

    const party = await prisma.sharedRaidParty.findUnique({
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
        reportedRaidId: partyId
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
          reportedRaidId: partyId,
          reportedUserId: party.authorId,
          reason,
          description: description || null
        }
      });

      // 공략의 신고 횟수 증가
      const updatedParty = await tx.sharedRaidParty.update({
        where: { id: partyId },
        data: { reportCount: { increment: 1 } }
      });

      // 5회 이상 신고된 경우 자동 블라인드 처리
      if (updatedParty.reportCount >= 5 && !updatedParty.isBlinded) {
        await tx.sharedRaidParty.update({
          where: { id: partyId },
          data: { isBlinded: true }
        });
      }
    });

    res.json({ success: true, message: '신고가 접수되었습니다.' });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});
// ==========================================
// Admin API for Reports & Bans
// ==========================================

// GET /api/raids/admin/reports - 전체 신고 목록 조회
router.get('/admin/reports', requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) {
      where.status = status;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, username: true, nickname: true } },
          reportedUser: { select: { id: true, username: true, nickname: true, penaltyStatus: true, bannedUntil: true } },
          reportedRaid: { select: { id: true, name: true, isBlinded: true, shortCode: true, mode: true, bossId: true, difficulty: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(limit)
      }),
      prisma.report.count({ where })
    ]);

    res.json({
      reports,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Admin GET reports error:', err);
    res.status(500).json({ error: '신고 목록 조회 중 오류가 발생했습니다.' });
  }
});

// PUT /api/raids/admin/reports/:id - 신고 상태 변경 및 제재 적용
router.put('/admin/reports/:id', requireAdmin, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const { status, action, penaltyDays } = req.body;
    // action: 'none', 'blind', 'ban_temp', 'ban_permanent'

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { reportedUser: true }
    });

    if (!report) {
      return res.status(404).json({ error: '신고 내역을 찾을 수 없습니다.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. 신고 상태 업데이트
      if (status) {
        await tx.report.update({
          where: { id: reportId },
          data: { status }
        });
      }

      // 2. 제재 액션 적용
      if (action === 'blind') {
        await tx.sharedRaidParty.update({
          where: { id: report.reportedRaidId },
          data: { isBlinded: true }
        });
      } else if (action === 'ban_temp') {
        const bannedUntil = new Date();
        bannedUntil.setDate(bannedUntil.getDate() + (penaltyDays || 7));
        
        await tx.user.update({
          where: { id: report.reportedUserId },
          data: { 
            penaltyStatus: 'TEMP_BANNED',
            bannedUntil 
          }
        });
      } else if (action === 'ban_permanent') {
        await tx.user.update({
          where: { id: report.reportedUserId },
          data: { penaltyStatus: 'BANNED' }
        });

        // IP 밴 로직
        if (report.reportedUser.lastLoginIp) {
          const ipExists = await tx.bannedIP.findUnique({
            where: { ipAddress: report.reportedUser.lastLoginIp }
          });
          if (!ipExists) {
            await tx.bannedIP.create({
              data: {
                ipAddress: report.reportedUser.lastLoginIp,
                reason: `영구정지된 유저(${report.reportedUser.username})의 IP`,
                bannedByAdminId: req.user.id
              }
            });
          }
        }
      }
    });

    res.json({ success: true, message: '처리가 완료되었습니다.' });
  } catch (err) {
    console.error('Admin update report error:', err);
    res.status(500).json({ error: '신고 처리 중 오류가 발생했습니다.' });
  }
});

// GET /api/raids/admin/banned-ips - 차단된 IP 목록
router.get('/admin/banned-ips', requireAdmin, async (req, res) => {
  try {
    const ips = await prisma.bannedIP.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(ips);
  } catch (err) {
    console.error('Admin GET banned IPs error:', err);
    res.status(500).json({ error: 'IP 목록 조회 실패' });
  }
});

// DELETE /api/raids/admin/banned-ips/:id - IP 차단 해제
router.delete('/admin/banned-ips/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.bannedIP.delete({ where: { id } });
    res.json({ success: true, message: 'IP 차단이 해제되었습니다.' });
  } catch (err) {
    console.error('Admin DELETE banned IP error:', err);
    res.status(500).json({ error: 'IP 차단 해제 실패' });
  }
});

module.exports = router;
