const { prisma } = require('../db');

const getMyCollections = async (userId) => {
  if (!userId) {
    return { collections: [], lastSyncTime: null };
  }
  const collections = await prisma.collection.findMany({
    where: { userId }
  });
  
  const lastSyncTime = collections.length > 0 
    ? new Date(Math.max(...collections.map(c => new Date(c.updatedAt).getTime()))).toISOString()
    : null;

  return { collections, lastSyncTime };
};

const syncCollections = async (userId, collectionsData) => {
  if (!Array.isArray(collectionsData)) {
    const error = new Error('collections 배열이 필요합니다.');
    error.status = 400;
    throw error;
  }

  let syncedCount = 0;

  for (const item of collectionsData) {
    if (!item || typeof item !== 'object') continue;
    
    let { studentId, starGrade, isOwned } = item;
    
    if (studentId === undefined || studentId === null) continue;
    
    studentId = parseInt(studentId, 10);
    if (isNaN(studentId)) continue;
    
    starGrade = starGrade !== undefined && starGrade !== null ? parseInt(starGrade, 10) : undefined;
    if (starGrade !== undefined && isNaN(starGrade)) starGrade = undefined;
    
    isOwned = isOwned !== undefined && isOwned !== null ? Boolean(isOwned) : true;

    try {
      const existing = await prisma.collection.findUnique({
        where: { userId_studentId: { userId, studentId } }
      });

      let updatedDetails = item;
      if (existing && existing.details) {
        const existingDetails = typeof existing.details === 'string' 
          ? JSON.parse(existing.details) 
          : existing.details;
        
        updatedDetails = { ...existingDetails, ...item };
      }

      await prisma.collection.upsert({
        where: {
          userId_studentId: { userId, studentId }
        },
        update: { starGrade, isOwned, details: updatedDetails },
        create: {
          userId, studentId, starGrade: starGrade || 3, isOwned, details: item
        }
      });
      syncedCount++;
    } catch (err) {
      console.warn(`Failed to sync student ${studentId} for user ${userId}:`, err?.message || err);
    }
  }

  return { syncedCount, lastSyncTime: new Date().toISOString() };
};

const getPublicCollection = async (uidStr) => {
  const uid = parseInt(uidStr, 10);
  if (isNaN(uid)) {
    const error = new Error('유효하지 않은 UID입니다.');
    error.status = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { uid } });
  if (!user) {
    const error = new Error('사용자를 찾을 수 없습니다.');
    error.status = 404;
    throw error;
  }

  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    include: { student: true }
  });

  return { username: user.username, uid: user.uid, collections };
};

const deleteAllCollections = async (userId) => {
  const deleted = await prisma.collection.deleteMany({
    where: { userId }
  });
  return { deletedCount: deleted.count };
};

module.exports = {
  getMyCollections,
  syncCollections,
  getPublicCollection,
  deleteAllCollections
};
