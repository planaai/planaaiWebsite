import type { StudentMaster, SchemaConfig } from '../types';
import { fetchServerData as _fetchServerData, fetchSchema as _fetchSchema } from './api';

/**
 * 전역 데이터 캐시 - 매 페이지 전환마다 대규모 데이터를 반복 로드하는 것을 방지합니다.
 * 
 * 문제: 7개 페이지가 각각 useEffect에서 fetchServerData() (884KB JSON)를 호출하여
 * SPA 네비게이션 시 이전 데이터가 GC되기 전에 새 데이터가 할당되어 메모리 압박이 발생.
 * 
 * 해결: 모듈 레벨 캐시 + 요청 중복 제거(deduplication)로 한 번만 로드
 */

const CACHE_TTL = 5 * 60 * 1000; // 5분

// --- Server Data Cache ---
let serverDataCache: { masterData: StudentMaster[]; archiveData: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[] } | null = null;
let serverDataCacheTime = 0;
let serverDataPromise: Promise<{ masterData: StudentMaster[]; archiveData: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[] }> | null = null;

export async function getCachedServerData(): Promise<{ masterData: StudentMaster[]; archiveData: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[] }> {
  const now = Date.now();

  // 캐시가 유효하면 즉시 반환
  if (serverDataCache && (now - serverDataCacheTime < CACHE_TTL)) {
    return serverDataCache;
  }

  // 이미 진행 중인 요청이 있으면 그 Promise를 재사용 (deduplication)
  if (serverDataPromise) {
    return serverDataPromise;
  }

  // 새 요청 시작
  serverDataPromise = _fetchServerData()
    .then(data => {
      // API 통신 실패나 Abort로 인해 빈 배열이 반환된 경우 캐시하지 않음
      if (!data || data.masterData.length === 0) {
        serverDataPromise = null;
        return data; // 이번엔 빈 값을 반환하지만 캐시되진 않음
      }
      serverDataCache = data;
      serverDataCacheTime = Date.now();
      serverDataPromise = null;
      return data;
    })
    .catch(err => {
      serverDataPromise = null;
      throw err;
    });

  return serverDataPromise;
}

// --- Schema Cache ---
let schemaCache: SchemaConfig | null = null;
let schemaCacheTime = 0;
let schemaPromise: Promise<SchemaConfig | null> | null = null;

export async function getCachedSchema(): Promise<SchemaConfig | null> {
  const now = Date.now();

  if (schemaCache && (now - schemaCacheTime < CACHE_TTL)) {
    return schemaCache;
  }

  if (schemaPromise) {
    return schemaPromise;
  }

  schemaPromise = _fetchSchema()
    .then(data => {
      schemaCache = data;
      schemaCacheTime = Date.now();
      schemaPromise = null;
      return data;
    })
    .catch(err => {
      schemaPromise = null;
      throw err;
    });

  return schemaPromise;
}

/**
 * 캐시를 무효화합니다. 데이터가 서버에서 변경된 후 강제 새로고침이 필요할 때 사용합니다.
 */
export function invalidateCache() {
  serverDataCache = null;
  serverDataCacheTime = 0;
  schemaCache = null;
  schemaCacheTime = 0;
}

export function getSyncServerDataCache() {
  const now = Date.now();
  if (serverDataCache && (now - serverDataCacheTime < CACHE_TTL)) {
    return serverDataCache;
  }
  return null;
}

export function getSyncSchemaCache() {
  const now = Date.now();
  if (schemaCache && (now - schemaCacheTime < CACHE_TTL)) {
    return schemaCache;
  }
  return null;
}
