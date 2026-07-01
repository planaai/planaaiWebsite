import type { StudentMaster, SchemaConfig } from '../types';
import { fetchServerData as _fetchServerData, fetchSchema as _fetchSchema } from './api';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간으로 연장 (Cloudflare Workers 요청 절감)
const LS_KEY_DATA = 'planaai_server_data';
const LS_KEY_DATA_TIME = 'planaai_server_data_time';
const LS_KEY_SCHEMA = 'planaai_schema_data';
const LS_KEY_SCHEMA_TIME = 'planaai_schema_time';

// --- Server Data Cache ---
let serverDataCache: { masterData: StudentMaster[]; archiveData: any[] } | null = null;
let serverDataCacheTime = 0;
let serverDataPromise: Promise<{ masterData: StudentMaster[]; archiveData: any[] }> | null = null;

export async function getCachedServerData(): Promise<{ masterData: StudentMaster[]; archiveData: any[] }> {
  const now = Date.now();

  // 1. 메모리 캐시 확인
  if (serverDataCache && (now - serverDataCacheTime < CACHE_TTL)) {
    return serverDataCache;
  }

  // 2. 로컬 스토리지 캐시 확인 (브라우저 환경)
  if (typeof window !== 'undefined') {
    try {
      const lsTime = localStorage.getItem(LS_KEY_DATA_TIME);
      if (lsTime && (now - parseInt(lsTime, 10) < CACHE_TTL)) {
        const lsData = localStorage.getItem(LS_KEY_DATA);
        if (lsData) {
          const parsed = JSON.parse(lsData);
          serverDataCache = parsed;
          serverDataCacheTime = parseInt(lsTime, 10);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to read server data from localStorage', e);
    }
  }

  if (serverDataPromise) {
    return serverDataPromise;
  }

  serverDataPromise = _fetchServerData()
    .then(data => {
      if (!data || data.masterData.length === 0) {
        serverDataPromise = null;
        return data;
      }
      serverDataCache = data;
      serverDataCacheTime = Date.now();
      
      // 3. 데이터를 로컬 스토리지에 저장
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LS_KEY_DATA, JSON.stringify(data));
          localStorage.setItem(LS_KEY_DATA_TIME, serverDataCacheTime.toString());
        } catch (e) {
          console.warn('Failed to save server data to localStorage (Quota Exceeded?)', e);
        }
      }

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

  if (typeof window !== 'undefined') {
    try {
      const lsTime = localStorage.getItem(LS_KEY_SCHEMA_TIME);
      if (lsTime && (now - parseInt(lsTime, 10) < CACHE_TTL)) {
        const lsData = localStorage.getItem(LS_KEY_SCHEMA);
        if (lsData) {
          const parsed = JSON.parse(lsData);
          schemaCache = parsed;
          schemaCacheTime = parseInt(lsTime, 10);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to read schema from localStorage', e);
    }
  }

  if (schemaPromise) {
    return schemaPromise;
  }

  schemaPromise = _fetchSchema()
    .then(data => {
      schemaCache = data;
      schemaCacheTime = Date.now();
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LS_KEY_SCHEMA, JSON.stringify(data));
          localStorage.setItem(LS_KEY_SCHEMA_TIME, schemaCacheTime.toString());
        } catch (e) {
          console.warn('Failed to save schema to localStorage', e);
        }
      }

      schemaPromise = null;
      return data;
    })
    .catch(err => {
      schemaPromise = null;
      throw err;
    });

  return schemaPromise;
}

export function invalidateCache() {
  serverDataCache = null;
  serverDataCacheTime = 0;
  schemaCache = null;
  schemaCacheTime = 0;
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LS_KEY_DATA);
      localStorage.removeItem(LS_KEY_DATA_TIME);
      localStorage.removeItem(LS_KEY_SCHEMA);
      localStorage.removeItem(LS_KEY_SCHEMA_TIME);
    } catch (e) {
      // ignore
    }
  }
}
