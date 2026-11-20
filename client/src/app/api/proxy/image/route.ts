import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

export const ALLOWED_HOSTS = [
  'plan4ai.fyi',
  'api.plan4ai.fyi',
  'raw.githubusercontent.com',
  'schale.gg',
];

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export function isAllowedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (ALLOWED_HOSTS.includes(lower)) return true;
  if (lower === 'nexon.com' || lower.endsWith('.nexon.com')) return true;
  if (lower === 'ytimg.com' || lower.endsWith('.ytimg.com')) return true;
  return false;
}

export function isValidImageMagicBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true;
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return true;
  }

  // GIF: 47 49 46 38 ('GIF8')
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return true;
  }

  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return true;
  }

  // AVIF / HEIF: ....ftyp (offset 4..7)
  if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) {
    return true;
  }

  return false;
}

async function fetchUpstreamImage(parsedUrl: URL): Promise<Response> {
  if (parsedUrl.hostname === 'api.plan4ai.fyi' && parsedUrl.pathname.startsWith('/uploads/')) {
    const backendPort = process.env.BACKEND_PORT || 3000;
    const localUrl = `http://127.0.0.1:${backendPort}${parsedUrl.pathname}${parsedUrl.search}`;

    try {
      const localRes = await fetch(localUrl, { headers: BROWSER_HEADERS });
      const localContentType = (localRes.headers.get('Content-Type') || '').toLowerCase().split(';')[0].trim();
      if (localRes.ok && ALLOWED_MIME_TYPES.has(localContentType)) {
        return localRes;
      }
    } catch {
      // Fallback to remote URL when loopback is unavailable (e.g. edge workers)
    }

    return fetch(parsedUrl.toString(), {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': 'https://plan4ai.fyi/',
      },
    });
  }

  return fetch(parsedUrl.toString(), {
    headers: {
      ...BROWSER_HEADERS,
      'Referer': parsedUrl.origin,
    },
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing url', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url, req.url);
  } catch {
    return new NextResponse('Invalid url', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return new NextResponse('Unsupported url protocol', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Prevent userinfo injection (@ in URL)
  if (parsedUrl.username || parsedUrl.password) {
    return new NextResponse('Userinfo not allowed in url', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Enforce host whitelist (SSRF & loopback/metadata exploit prevention)
  if (!isAllowedHost(parsedUrl.hostname)) {
    return new NextResponse('Host not allowed', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const res = await fetchUpstreamImage(parsedUrl);

    if (!res.ok) {
      return new NextResponse(`Failed to fetch image: ${res.statusText}`, {
        status: res.status,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const rawContentType = (res.headers.get('Content-Type') || '').toLowerCase().split(';')[0].trim();

    // Strictly enforce allowed image MIME types
    if (!ALLOWED_MIME_TYPES.has(rawContentType)) {
      return new NextResponse(`Disallowed MIME type: ${rawContentType || 'unknown'}`, {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const buffer = await res.arrayBuffer();

    // Verify binary magic bytes to prevent MIME-confusion and SVG/HTML/polyglot XSS attacks
    if (!isValidImageMagicBytes(buffer)) {
      return new NextResponse('Invalid image binary content', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', rawContentType);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-Content-Type-Options', 'nosniff');

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Error fetching image', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
