/**
 * Centralized YouTube URL parsing and embed link generation utilities.
 */

const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtu.be',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
]);

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeVideoId(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();

  try {
    const parsed = new URL(
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`
    );
    const host = parsed.hostname.toLowerCase();

    if (!ALLOWED_YOUTUBE_HOSTS.has(host)) {
      return null;
    }

    if (host === 'youtu.be') {
      const match = parsed.pathname.match(/^\/([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : null;
    }

    if (parsed.pathname === '/watch' || parsed.pathname === '/watch/') {
      const v = parsed.searchParams.get('v');
      return v && VIDEO_ID_REGEX.test(v) ? v : null;
    }

    const match = parsed.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(url: unknown): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}
