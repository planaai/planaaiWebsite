export const getImageUrl = (url: string) => {
  if (!url) return '';
  return url.startsWith('http') ? url : `http://127.0.0.1:3000${url}`;
};
