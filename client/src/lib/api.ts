import axios from 'axios';
import type { StudentMaster, SchemaConfig } from '../types';

export const API_BASE = typeof window !== 'undefined' ? 'https://api.planaai.kro.kr/api' : 'https://api.planaai.kro.kr/api';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      // optional: window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { api };

export const fetchServerData = async (retries = 3): Promise<{ masterData: StudentMaster[], archiveData: any[] }> => {
  for (let i = 0; i < retries; i++) {
    try {
      const resArchive = await api.get('/archive');
      const data = resArchive.data.data || [];
      const masterData = data.map((d: any) => d.master);
      const archiveData = data.map((d: any) => d.archive).filter(Boolean);
      return { masterData, archiveData };
    } catch (error: any) {
      if (i === retries - 1) {
        console.error('Failed to fetch server data after retries:', error);
        return { masterData: [], archiveData: [] };
      }
      // 실패 시 1초 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return { masterData: [], archiveData: [] };
};

export const fetchSchema = async (): Promise<SchemaConfig | null> => {
  try {
    const res = await axios.get(`${API_BASE}/schema`);
    return res.data;
  } catch (error) {
    console.error('Failed to fetch schema:', error);
    return null;
  }
};

export const syncCollectionToServer = async (collections: any[]) => {
  const res = await api.post('/collection/sync', { collections });
  return res.data;
};

export const fetchCollectionFromServer = async () => {
  const res = await api.get('/collection');
  return res.data;
};

export const loginUser = async (data: any) => {
  const res = await axios.post(`${API_BASE}/auth/login`, data);
  return res.data;
};

export const updateProfile = async (nickname: string) => {
  const res = await api.put('/auth/me', { nickname });
  return res.data;
};

export const fetchCurrentUser = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const deleteCollectionFromServer = async () => {
  const res = await api.delete('/collection');
  return res.data;
};

