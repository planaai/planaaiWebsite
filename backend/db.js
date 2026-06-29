/**
 * 공유 DB 클라이언트 (싱글턴)
 * - PrismaClient와 pg Pool을 한 번만 생성하여 모든 라우터에서 공유
 * - 메모리 누수 방지: 여러 모듈에서 각각 new Pool / new PrismaClient 하던 것을 제거
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.startsWith('prisma+postgres://')) {
  const urlObj = new URL(connectionString);
  const apiKey = urlObj.searchParams.get('api_key');
  if (apiKey) {
    const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
    const json = JSON.parse(decoded);
    connectionString = json.databaseUrl;
  }
}

// 커넥션 풀과 Prisma 클라이언트를 한 번만 생성
const pool = new Pool({
  connectionString,
  max: 10,                // 최대 커넥션 수 제한
  idleTimeoutMillis: 30000, // 유휴 커넥션 30초 후 해제
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = { prisma, pool };
