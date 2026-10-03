const { prisma } = require('../db');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const getParties = async (query, user) => {
  const { deckType, q, sort } = query;
  
  const whereClause = { isBlinded: false };
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
      const likedParties = await prisma.sharedPvpPartyLike.findMany({
        where: {
          userId: user.id,
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

  return parties;
};

const createParty = async (data, file, userId) => {
  const { name, party: subParty, deckType, tags, tactics, strategyCode, youtubeUrls } = data;
  const authorId = userId;

  if (!name || !subParty || !deckType) {
    throw new Error('필수 항목이 누락되었습니다.');
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
    throw new Error('데이터 형식이 잘못되었습니다.');
  }

  const imagePath = file ? '/uploads/raids/' + file.filename : null;
  const shortCode = crypto.randomBytes(3).toString('hex').toUpperCase();

  return await prisma.sharedPvpParty.create({
    data: {
      shortCode, deckType, name,
      party: parsedParty, tags: parsedTags, tactics: tactics || '',
      strategyCode: strategyCode || null, imagePath,
      youtubeUrls: parsedYoutubeUrls.length > 0 ? parsedYoutubeUrls : null,
      authorId
    }
  });
};

const getPartyByCode = async (code, user) => {
  const whereClause = [{ shortCode: code }];
  if (!isNaN(parseInt(code))) {
    whereClause.push({ id: parseInt(code) });
  }

  const partyData = await prisma.sharedPvpParty.findFirst({
    where: { AND: [{ OR: whereClause }, { isBlinded: false }] },
    include: {
      User: { select: { id: true, nickname: true, username: true } }
    }
  });

  if (!partyData) throw new Error('조합을 찾을 수 없습니다.');

  const { User, ...rest } = partyData;
  const party = { ...rest, author: User };

  if (user) {
    const like = await prisma.sharedPvpPartyLike.findUnique({
      where: { userId_partyId: { userId: user.id, partyId: party.id } }
    });
    party.isLiked = !!like;
  } else {
    party.isLiked = false;
  }

  return party;
};

const updateParty = async (id, data, file, user) => {
  const partyId = parseInt(id);
  const partyToUpdate = await prisma.sharedPvpParty.findUnique({ where: { id: partyId } });
  if (!partyToUpdate) throw new Error('조합을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && partyToUpdate.authorId !== user.id) {
    throw new Error('권한이 없습니다.');
  }

  const { name, party: subParty, deckType, tags, tactics, strategyCode, youtubeUrls } = data;
  
  let parsedParty;
  let parsedTags;
  let parsedYoutubeUrls = [];
  try {
    if (subParty) parsedParty = JSON.parse(subParty);
    if (tags) parsedTags = JSON.parse(tags);
    if (youtubeUrls) parsedYoutubeUrls = JSON.parse(youtubeUrls);
  } catch (e) {
    throw new Error('데이터 형식이 잘못되었습니다.');
  }

  const updateData = {};
  if (name) updateData.name = name;
  if (deckType) updateData.deckType = deckType;
  if (parsedParty) updateData.party = parsedParty;
  if (parsedTags) updateData.tags = parsedTags;
  if (tactics !== undefined) updateData.tactics = tactics;
  if (strategyCode !== undefined) updateData.strategyCode = strategyCode || null;
  if (youtubeUrls !== undefined) updateData.youtubeUrls = parsedYoutubeUrls.length > 0 ? parsedYoutubeUrls : null;

  if (file) {
    updateData.imagePath = '/uploads/raids/' + file.filename;
    if (partyToUpdate.imagePath) {
      try {
        const oldPath = path.join(__dirname, '..', partyToUpdate.imagePath);
        await fs.unlink(oldPath);
      } catch (err) {}
    }
  }

  return await prisma.sharedPvpParty.update({
    where: { id: partyId },
    data: updateData
  });
};

const deleteParty = async (id, user) => {
  const partyId = parseInt(id);
  const party = await prisma.sharedPvpParty.findUnique({ where: { id: partyId } });

  if (!party) throw new Error('조합을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && party.authorId !== user.id) {
    throw new Error('권한이 없습니다.');
  }

  await prisma.sharedPvpParty.delete({ where: { id: partyId } });

  if (party.imagePath) {
    try {
      const fullPath = path.join(__dirname, '..', party.imagePath);
      await fs.unlink(fullPath);
    } catch (err) {}
  }

  return { success: true };
};

const toggleLike = async (id, user) => {
  const partyId = parseInt(id);
  const userData = await prisma.user.findUnique({ where: { id: user.id } });
  if (userData.isShadowBanned) return { success: true, fake: true };

  const existingLike = await prisma.sharedPvpPartyLike.findUnique({
    where: { userId_partyId: { userId: userData.id, partyId } }
  });

  if (existingLike) {
    await prisma.$transaction([
      prisma.sharedPvpPartyLike.delete({ where: { id: existingLike.id } }),
      prisma.sharedPvpParty.update({ where: { id: partyId }, data: { likeCount: { decrement: 1 } } })
    ]);
    return { success: true, liked: false };
  } else {
    await prisma.$transaction([
      prisma.sharedPvpPartyLike.create({
        data: { userId: userData.id, partyId }
      }),
      prisma.sharedPvpParty.update({ where: { id: partyId }, data: { likeCount: { increment: 1 } } })
    ]);
    return { success: true, liked: true };
  }
};

const reportParty = async (id, data, userId) => {
  const partyId = parseInt(id);
  if (isNaN(partyId)) throw new Error('잘못된 파티 ID 입니다.');

  const { reason, description } = data;
  if (!reason) throw new Error('신고 사유를 선택해주세요.');

  const party = await prisma.sharedPvpParty.findUnique({ where: { id: partyId } });
  if (!party) throw new Error('공략을 찾을 수 없습니다.');
  if (party.authorId === userId) throw new Error('본인의 공략은 신고할 수 없습니다.');

  const existingReport = await prisma.report.findFirst({
    where: { reporterId: userId, reportedPvpPartyId: partyId }
  });

  if (existingReport) throw new Error('이미 해당 공략을 신고하셨습니다.');

  await prisma.$transaction(async (tx) => {
    await tx.report.create({
      data: {
        reporterId: userId,
        reportedPvpPartyId: partyId,
        reportedUserId: party.authorId,
        reason,
        description: description || null
      }
    });

    const updatedParty = await tx.sharedPvpParty.update({
      where: { id: partyId },
      data: { reportCount: { increment: 1 } }
    });

    if (updatedParty.reportCount >= 5 && !updatedParty.isBlinded) {
      await tx.sharedPvpParty.update({
        where: { id: partyId },
        data: { isBlinded: true }
      });
    }
  });

  return { success: true, message: '신고가 접수되었습니다.' };
};

module.exports = {
  getParties, createParty, getPartyByCode, updateParty, deleteParty, toggleLike, reportParty
};
