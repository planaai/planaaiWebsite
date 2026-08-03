import { API_BASE } from '../../lib/api';

export const getImageUrl = (url: string) => {
  if (!url) return '';
  try {
    const baseUrl = new URL(API_BASE).origin;
    if (url.startsWith('/images/')) return url;
    return url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;
  } catch (e) {
    return url;
  }
};
