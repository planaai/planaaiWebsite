import axios from 'axios';
import type { StudentMaster, SchemaConfig } from '../types';

export const API_BASE = typeof window !== 'undefined' ? 'https://api.planaai.kro.kr/api' : 'https://api.planaai.kro.kr/api';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use(async (config) => {
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
    }
    return Promise.reject(error);
  }
);

export { api };

export const loginUser = async (data: any) => {
  const res = await axios.post(`${API_BASE}/auth/login`, data);
  return res.data;
};

export const fetchCurrentUser = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const getImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  try {
    const baseUrl = new URL(API_BASE).origin;
    return url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;
  } catch (e) {
    return url;
  }
};

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
