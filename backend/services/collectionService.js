const { prisma } = require('../db');

class CollectionService {
  static async getUserCollections(userId) {
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
  }

  static async syncCollections(userId, collections) {
    if (!Array.isArray(collections)) {
      const error = new Error('collections 배열이 필요합니다.');
      error.status = 400;
      throw error;
    }
    if (!userId) {
      const error = new Error('인증 정보가 유효하지 않습니다.');
      error.status = 401;
      throw error;
    }

    let syncedCount = 0;

    for (const item of collections) {
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
          
          // 타임스탬프 기반 덮어쓰기 방지:
          // DB의 데이터가 더 최신(capturedAt 기준)인 경우, 클라이언트의 오래된 item 전체 덮어쓰기 방지
          const existingTime = existingDetails.capturedAt ? new Date(existingDetails.capturedAt).getTime() : 0;
          const incomingTime = item.capturedAt ? new Date(item.capturedAt).getTime() : 0;

          if (existingTime > 0 && incomingTime > 0 && existingTime > incomingTime) {
            // DB 데이터가 더 최신이면 기존 데이터를 우선하고 들어온 변경사항만 보존
            updatedDetails = { ...item, ...existingDetails };
          } else {
            updatedDetails = { ...existingDetails, ...item };
          }
        }

        await prisma.collection.upsert({
          where: { userId_studentId: { userId, studentId } },
          update: { starGrade, isOwned, details: updatedDetails },
          create: { userId, studentId, starGrade: starGrade || 3, isOwned, details: item }
        });
        syncedCount++;
      } catch (err) {
        console.warn(`Failed to sync student ${studentId} for user ${userId}:`, err?.message || err);
      }
    }

    const lastSyncTime = new Date().toISOString();
    return { syncedCount, lastSyncTime };
  }

  static async getPublicCollections(uid) {
    const parsedUid = parseInt(uid, 10);
    if (isNaN(parsedUid)) {
      const error = new Error('유효하지 않은 UID입니다.');
      error.status = 400;
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { uid: parsedUid } });
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
  }

  static async deleteUserCollections(userId) {
    const deleted = await prisma.collection.deleteMany({
      where: { userId }
    });
    return deleted.count || deleted;
  }
}

// 호환성 별칭
CollectionService.getMyCollections = CollectionService.getUserCollections;
CollectionService.getPublicCollection = CollectionService.getPublicCollections;
CollectionService.deleteAllCollections = CollectionService.deleteUserCollections;

module.exports = CollectionService;
