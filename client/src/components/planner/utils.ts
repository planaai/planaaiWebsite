import { API_BASE } from '../../lib/api';

export const getImageUrl = (url: string) => {
  if (!url) return '';
  const baseUrl = API_BASE.replace('/api', '');
  return url.startsWith('http') ? url : `${baseUrl}${url}`;
};
