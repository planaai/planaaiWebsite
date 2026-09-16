const { prisma } = require('../db');

// 캐싱을 위한 간단한 메모리 셋과 타임스탬프
let bannedIpsCache = new Set();
let lastCacheUpdate = 0;
const CACHE_TTL = 60 * 1000; // 1분

async function ipBanMiddleware(req, res, next) {
  try {
    // 클라이언트 IP 추출 (Cloudflare 및 리버스 프록시 대응)
    let clientIp = req.headers['cf-connecting-ip'] || req.ip || req.socket.remoteAddress;
    
    if (clientIp && clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim();
    }

    if (!clientIp) {
      return next(); // IP를 식별할 수 없으면 통과
    }

    // 캐시 만료 시 DB에서 밴된 IP 목록 새로고침
    const now = Date.now();
    if (now - lastCacheUpdate > CACHE_TTL) {
      const bans = await prisma.bannedIP.findMany({
        select: { ipAddress: true }
      });
      bannedIpsCache = new Set(bans.map(b => b.ipAddress));
      lastCacheUpdate = now;
    }

    // 차단된 IP인지 확인
    if (bannedIpsCache.has(clientIp)) {
      return res.status(403).json({ 
        error: '접근이 차단된 IP입니다.',
        isBanned: true
      });
    }

    next();
  } catch (error) {
    console.error('IP Ban Middleware Error:', error);
    // 에러 발생 시에도 정상 진행 (DB 장애로 인한 전체 서비스 중단 방지)
    next();
  }
}

module.exports = { ipBanMiddleware };
