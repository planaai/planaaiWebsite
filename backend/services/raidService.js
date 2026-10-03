const { prisma } = require('../db');
const { verifyRecaptcha } = require('../utils/recaptcha');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const getMeta = async () => {
  const bosses = await prisma.raidBoss.findMany({
    include: { RaidSeason: true }
  });
  
  const allBosses = bosses.map(b => ({
    id: b.id,
    name: b.name,
    iconUrl: b.iconUrl,
    bannerUrl: b.bannerUrl,
    defenseType: b.defenseType,
    category: b.category
  }));
  
  const allSeasons = bosses.flatMap(b => (b.RaidSeason || []).map(s => ({
    id: s.id,
    bossId: s.bossId,
    terrain: s.terrain,
    difficulty: s.difficulty,
    parties: [] 
  })));

  return { bosses: allBosses, seasons: allSeasons };
};

const getYoutubeMeta = async (url) => {
  const isYouTube = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i.test(url);
  if (!isYouTube) {
    throw new Error('유효한 유튜브 동영상 URL이 아닙니다.');
  }
  
  const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return { title: data.title || '', channel: data.author_name || '' };
};

const createBoss = async (data) => {
  const { id, name, iconUrl, bannerUrl, defenseType, category } = data;
  return await prisma.raidBoss.create({
    data: { id, name, iconUrl, bannerUrl, defenseType, category: category || 'Assault' }
  });
};

const updateBoss = async (id, data) => {
  const { name, iconUrl, bannerUrl, defenseType, category } = data;
  return await prisma.raidBoss.update({
    where: { id },
    data: { name, iconUrl, bannerUrl, defenseType, category: category || 'Assault' }
  });
};

const deleteBoss = async (id) => {
  return await prisma.raidBoss.delete({ where: { id } });
};

const createSeason = async (data) => {
  const { bossId, terrain } = data;
  const difficulties = ['Normal', 'Hard', 'VeryHard', 'Hardcore', 'Extreme', 'Insane', 'Torment', 'Lunatic'];
  const dataToInsert = difficulties.map(diff => ({ bossId, terrain, difficulty: diff }));

  await prisma.raidSeason.createMany({ data: dataToInsert, skipDuplicates: true });
  return { success: true };
};

const syncSeasons = async () => {
  const existingSeasons = await prisma.raidSeason.findMany({
    select: { bossId: true, terrain: true },
    distinct: ['bossId', 'terrain']
  });

  const difficulties = ['Normal', 'Hard', 'VeryHard', 'Hardcore', 'Extreme', 'Insane', 'Torment', 'Lunatic'];
  const dataToInsert = [];

  for (const s of existingSeasons) {
    for (const diff of difficulties) {
      dataToInsert.push({ bossId: s.bossId, terrain: s.terrain, difficulty: diff });
    }
  }

  await prisma.raidSeason.createMany({ data: dataToInsert, skipDuplicates: true });
  return { success: true, message: '모든 보스 난이도 동기화 완료' };
};

const getParties = async (query, user) => {
  const { bossId, terrain, difficulty, mode, q, sort, filters } = query;
  
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

  const partiesData = await prisma.sharedRaidParty.findMany({
    where: whereClause,
    include: {
      User: { select: { id: true, nickname: true, username: true } }
    },
    orderBy,
    take: 50 
  });

  const parties = partiesData.map(p => {
    const { User, ...rest } = p;
    return { ...rest, author: User };
  });

  if (user && user.id && parties.length > 0) {
    try {
      const likedParties = await prisma.sharedRaidPartyLike.findMany({
        where: { userId: user.id, partyId: { in: parties.map(p => p.id) } }
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

  return parties;
};

const createParty = async (data, file, userId) => {
  const { name, parties: subParties, bossId, terrain, difficulty, tags, tactics, clearTime, mode, youtubeUrls } = data;
  const authorId = userId;

  const missingFields = [];
  if (!name) missingFields.push('이름');
  if (!subParties) missingFields.push('사용 부대(파티)');
  if (!bossId) missingFields.push('보스');
  if (!terrain) missingFields.push('지형');
  if (!difficulty) missingFields.push('난이도');
  if (!mode) missingFields.push('분류(모드)');

  if (missingFields.length > 0) {
    throw new Error(`필수 항목이 누락되었습니다: ${missingFields.join(', ')}`);
  }

  if (!file) {
    throw new Error('이미지 첨부는 필수입니다.');
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
        throw new Error('유튜브 링크는 최대 5개까지 등록할 수 있습니다.');
      }
      const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
      for (const video of parsedYoutubeUrls) {
        if (!video.url) throw new Error('유튜브 URL을 입력해주세요.');
        if (!youtubeRegex.test(video.url.trim())) {
          throw new Error('유효하지 않은 YouTube 롱폼 영상 URL이 포함되어 있습니다. (Shorts 불가)');
        }
      }
    }
  } catch (e) {
    throw new Error(e.message || '데이터 형식이 잘못되었습니다.');
  }

  const imagePath = '/uploads/raids/' + file.filename;
  const shortCode = crypto.randomBytes(3).toString('hex').toUpperCase();

  return await prisma.sharedRaidParty.create({
    data: {
      shortCode, mode, bossId, terrain, difficulty, name,
      parties: parsedParties, tags: parsedTags, tactics: tactics || '',
      clearTime: clearTime || null, imagePath,
      youtubeUrls: parsedYoutubeUrls.length > 0 ? parsedYoutubeUrls : null,
      authorId
    }
  });
};

const updateParty = async (id, data, file, user) => {
  const authorId = user.id;
  const userRole = user.role;
  const { mode, name, bossId, terrain, difficulty, tags, tactics, clearTime, parties: subParties, youtubeUrls } = data;

  const existingParty = await prisma.sharedRaidParty.findUnique({
    where: { id: parseInt(id) }
  });

  if (!existingParty) throw new Error('공략을 찾을 수 없습니다.');
  if (existingParty.authorId !== authorId && userRole !== 'ADMIN') throw new Error('공략을 수정할 권한이 없습니다.');

  let parsedParties;
  let parsedTags;
  let parsedYoutubeUrls = [];
  try {
    parsedParties = subParties ? JSON.parse(subParties) : existingParty.parties;
    parsedTags = tags ? JSON.parse(tags) : existingParty.tags;
    if (youtubeUrls) {
      parsedYoutubeUrls = JSON.parse(youtubeUrls);
      if (!Array.isArray(parsedYoutubeUrls) || parsedYoutubeUrls.length > 5) {
        throw new Error('유튜브 링크는 최대 5개까지 등록할 수 있습니다.');
      }
      const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
      for (const video of parsedYoutubeUrls) {
        if (!video.url) throw new Error('유튜브 URL을 입력해주세요.');
        if (!youtubeRegex.test(video.url.trim())) {
          throw new Error('유효하지 않은 YouTube 롱폼 영상 URL이 포함되어 있습니다. (Shorts 불가)');
        }
      }
    } else {
      parsedYoutubeUrls = existingParty.youtubeUrls;
    }
  } catch (e) {
    throw new Error(e.message || '데이터 형식이 잘못되었습니다.');
  }

  const imagePath = file ? '/uploads/raids/' + file.filename : existingParty.imagePath;

  return await prisma.sharedRaidParty.update({
    where: { id: parseInt(id) },
    data: {
      mode: mode || existingParty.mode,
      bossId: bossId || existingParty.bossId,
      terrain: terrain || existingParty.terrain,
      difficulty: difficulty || existingParty.difficulty,
      name: name !== undefined ? name : existingParty.name,
      parties: parsedParties, tags: parsedTags,
      tactics: tactics !== undefined ? tactics : existingParty.tactics,
      clearTime: clearTime !== undefined ? clearTime : existingParty.clearTime,
      imagePath,
      youtubeUrls: parsedYoutubeUrls && parsedYoutubeUrls.length > 0 ? parsedYoutubeUrls : null,
    }
  });
};

const getPartyByCode = async (code, user) => {
  const whereClause = [{ shortCode: code }];
  if (!isNaN(parseInt(code))) {
    whereClause.push({ id: parseInt(code) });
  }

  const partyData = await prisma.sharedRaidParty.findFirst({
    where: { OR: whereClause },
    include: { User: { select: { id: true, nickname: true, username: true } } }
  });

  if (!partyData) throw new Error('공략을 찾을 수 없습니다.');

  const { User, ...rest } = partyData;
  const party = { ...rest, author: User };

  if (user) {
    const like = await prisma.sharedRaidPartyLike.findUnique({
      where: { userId_partyId: { userId: user.id, partyId: party.id } }
    });
    party.isLiked = !!like;
  } else {
    party.isLiked = false;
  }

  return party;
};

const deleteParty = async (id, user) => {
  const partyId = parseInt(id);
  if (isNaN(partyId)) throw new Error('잘못된 파티 ID 입니다.');

  const party = await prisma.sharedRaidParty.findUnique({ where: { id: partyId } });
  if (!party) throw new Error('파티를 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && party.authorId !== user.id) throw new Error('삭제 권한이 없습니다.');

  await prisma.sharedRaidParty.delete({ where: { id: partyId } });

  if (party.imagePath) {
    try {
      const fullPath = path.join(__dirname, '..', party.imagePath);
      await fs.unlink(fullPath);
    } catch (err) {
      console.error(`Failed to delete image file: ${party.imagePath}`, err);
    }
  }

  return { success: true };
};

const toggleLike = async (id, reqBody, reqHeaders, reqIp, userToken) => {
  const partyId = parseInt(id);
  if (isNaN(partyId)) throw new Error('잘못된 파티 ID 입니다.');
  
  const user = await prisma.user.findUnique({ where: { id: userToken.id } });
  if (user.isShadowBanned) return { success: true, fake: true };

  const existingLike = await prisma.sharedRaidPartyLike.findUnique({
    where: { userId_partyId: { userId: user.id, partyId } }
  });

  if (!existingLike) {
    const { turnstileToken } = reqBody;
    const isHuman = await verifyRecaptcha(turnstileToken);
    if (!isHuman) throw new Error('비정상적인 접근입니다. (보안 인증 실패)');
  }

  const deviceFp = reqHeaders['x-device-fingerprint'] || null;
  const ipAddress = reqIp;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  if (!existingLike && user.createdAt > oneDayAgo && deviceFp) {
    const usersOnDevice = await prisma.sharedRaidPartyLike.findMany({
      where: { deviceFp },
      select: { userId: true },
      distinct: ['userId']
    });
    if (usersOnDevice.length >= 3) {
      await prisma.user.update({ where: { id: user.id }, data: { isShadowBanned: true } });
      return { success: true, fake: true };
    }
  }

  if (existingLike) {
    await prisma.$transaction([
      prisma.sharedRaidPartyLike.delete({ where: { id: existingLike.id } }),
      prisma.sharedRaidParty.update({ where: { id: partyId }, data: { likeCount: { decrement: 1 } } })
    ]);
    return { success: true, liked: false };
  } else {
    await prisma.$transaction([
      prisma.sharedRaidPartyLike.create({
        data: { userId: user.id, partyId, deviceFp, ipAddress }
      }),
      prisma.sharedRaidParty.update({ where: { id: partyId }, data: { likeCount: { increment: 1 } } })
    ]);
    return { success: true, liked: true };
  }
};

const reportParty = async (id, data, userId) => {
  const partyId = parseInt(id);
  if (isNaN(partyId)) throw new Error('잘못된 파티 ID 입니다.');

  const { reason, description } = data;
  if (!reason) throw new Error('신고 사유를 선택해주세요.');

  const party = await prisma.sharedRaidParty.findUnique({ where: { id: partyId } });
  if (!party) throw new Error('공략을 찾을 수 없습니다.');
  if (party.authorId === userId) throw new Error('본인의 공략은 신고할 수 없습니다.');

  const existingReport = await prisma.report.findFirst({
    where: { reporterId: userId, reportedRaidId: partyId }
  });
  if (existingReport) throw new Error('이미 해당 공략을 신고하셨습니다.');

  await prisma.$transaction(async (tx) => {
    await tx.report.create({
      data: {
        reporterId: userId,
        reportedRaidId: partyId,
        reportedUserId: party.authorId,
        reason,
        description: description || null
      }
    });

    const updatedParty = await tx.sharedRaidParty.update({
      where: { id: partyId },
      data: { reportCount: { increment: 1 } }
    });

    if (updatedParty.reportCount >= 5 && !updatedParty.isBlinded) {
      await tx.sharedRaidParty.update({
        where: { id: partyId },
        data: { isBlinded: true }
      });
    }
  });

  return { success: true, message: '신고가 접수되었습니다.' };
};

const getReports = async (query) => {
  const { status, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, username: true, nickname: true } },
        reportedUser: { select: { id: true, username: true, nickname: true, penaltyStatus: true, bannedUntil: true } },
        reportedRaid: { select: { id: true, name: true, isBlinded: true, shortCode: true, mode: true, bossId: true, difficulty: true } },
        reportedPvpParty: { select: { id: true, name: true, isBlinded: true, shortCode: true, deckType: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: Number(skip),
      take: Number(limit)
    }),
    prisma.report.count({ where })
  ]);

  return {
    reports,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    }
  };
};

const updateReport = async (id, data, adminId) => {
  const reportId = parseInt(id);
  const { status, action, penaltyDays } = data;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { reportedUser: true }
  });

  if (!report) throw new Error('신고 내역을 찾을 수 없습니다.');

  await prisma.$transaction(async (tx) => {
    if (status) {
      await tx.report.update({ where: { id: reportId }, data: { status } });
    }

    if (action === 'blind') {
      if (report.reportedRaidId) {
        await tx.sharedRaidParty.update({
          where: { id: report.reportedRaidId },
          data: { isBlinded: true }
        });
      }
      if (report.reportedPvpPartyId) {
        await tx.sharedPvpParty.update({
          where: { id: report.reportedPvpPartyId },
          data: { isBlinded: true }
        });
      }
    } else if (action === 'ban_temp') {
      const bannedUntil = new Date();
      bannedUntil.setDate(bannedUntil.getDate() + (penaltyDays || 7));
      
      await tx.user.update({
        where: { id: report.reportedUserId },
        data: { penaltyStatus: 'TEMP_BANNED', bannedUntil }
      });
    } else if (action === 'ban_permanent') {
      await tx.user.update({
        where: { id: report.reportedUserId },
        data: { penaltyStatus: 'BANNED' }
      });

      if (report.reportedUser.lastLoginIp) {
        const ipExists = await tx.bannedIP.findUnique({
          where: { ipAddress: report.reportedUser.lastLoginIp }
        });
        if (!ipExists) {
          await tx.bannedIP.create({
            data: {
              ipAddress: report.reportedUser.lastLoginIp,
              reason: `영구정지된 유저(${report.reportedUser.username})의 IP`,
              bannedByAdminId: adminId
            }
          });
        }
      }
    }
  });

  return { success: true, message: '처리가 완료되었습니다.' };
};

const getBannedIps = async () => {
  return await prisma.bannedIP.findMany({ orderBy: { createdAt: 'desc' } });
};

const deleteBannedIp = async (id) => {
  await prisma.bannedIP.delete({ where: { id: parseInt(id) } });
  return { success: true, message: 'IP 차단이 해제되었습니다.' };
};

module.exports = {
  getMeta, getYoutubeMeta,
  createBoss, updateBoss, deleteBoss,
  createSeason, syncSeasons,
  getParties, createParty, updateParty, getPartyByCode, deleteParty,
  toggleLike, reportParty,
  getReports, updateReport,
  getBannedIps, deleteBannedIp
};
