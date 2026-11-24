import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const E2E_LIVE = process.env.E2E_LIVE === '1';
export const E2E_STRICT = process.env.E2E_STRICT === '1' || E2E_LIVE;
export const OCR_ENGINE_URL = (process.env.OCR_ENGINE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
export const BACKEND_URL = (process.env.BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
export const CLIENT_URL = (process.env.CLIENT_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
export const OCR_ENGINE_TOKEN = process.env.OCR_ENGINE_TOKEN || 'test-engine-token';

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_SLOTS = new Set(['main', 'equip1', 'equip2', 'equip3', 'favorite']);
export const EXPECTED_SCENES = {
  main: 'student_info',
  equip1: 'equipment_modal',
  equip2: 'equipment_modal',
  equip3: 'equipment_modal',
  favorite: 'favorite_popup',
};

export const PROTECTED_PATHS = [
  'backend/data',
  'backend/prisma',
  'backend/uploads',
  'client/src/data/imageOffsets.json',
];

export const PRESERVED_STORAGE_KEYS = [
  'ba-personal-archive',
  'formation-storage',
  'auth_token',
  'planner-storage',
  'ba-planner-archive',
];

export function requireLive(t, reason = 'Requires E2E_LIVE=1 (running ocr-engine/backend/client services)') {
  if (!E2E_LIVE) {
    t.skip(reason);
    return false;
  }
  return true;
}

export function requireStrict(t, reason = 'Requires E2E_STRICT=1 or E2E_LIVE=1 (M2-M5 repo deliverables)') {
  if (!E2E_STRICT) {
    t.skip(reason);
    return false;
  }
  return true;
}

// --- Ajv Schema Validator (via backend/node_modules/ajv) ---

const require = createRequire(import.meta.url);
const Ajv = require(path.join(REPO_ROOT, 'backend', 'node_modules', 'ajv'));
const SCHEMA_PATH = path.join(REPO_ROOT, 'ocr-engine', 'contract', 'recognize.schema.json');
const recognizeSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

const ajvOpts = { allErrors: true, strict: false };
const ajv = new Ajv(ajvOpts);
export const validateRecognizeSchema = ajv.compile(recognizeSchema);
export const validateSuccessResponse = new Ajv(ajvOpts).compile({
  ...recognizeSchema,
  $ref: '#/definitions/SuccessResponse',
  oneOf: undefined,
});
export const validateErrorResponse = new Ajv(ajvOpts).compile({
  ...recognizeSchema,
  $ref: '#/definitions/ErrorResponse',
  oneOf: undefined,
});

export function loadMock(name) {
  const p = path.join(REPO_ROOT, 'ocr-engine', 'contract', 'mocks', name);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function assertValidSuccess(payload, { requireSuccessFlag = false } = {}) {
  const ok = validateSuccessResponse(payload);
  assert.equal(ok, true, `SuccessResponse schema error: ${ajv.errorsText(validateSuccessResponse.errors)}`);
  assert.equal(validateRecognizeSchema(payload), true);
  assert.equal(Object.hasOwn(payload.data, 'bondRank'), true, 'bondRank key must always exist');
  for (const [k, stat] of Object.entries(payload.data.stats)) {
    assert.notEqual(stat.releaseLevel, 0, `stats.${k}.releaseLevel must never be 0`);
  }
  if (requireSuccessFlag) {
    assert.equal(payload.success, true);
  }
}

export function assertValidError(payload, { requireSuccessFlag = false } = {}) {
  const ok = validateErrorResponse(payload);
  assert.equal(ok, true, `ErrorResponse schema error: ${ajv.errorsText(validateErrorResponse.errors)}`);
  assert.equal(validateRecognizeSchema(payload), true);
  if (requireSuccessFlag) {
    assert.equal(payload.success, false);
    assert.equal(typeof payload.error, 'string');
    assert.ok(payload.error.length > 0);
  }
}

// --- CRC32 & Synthetic In-Memory Image Builders ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export function makePngBuffer(width, height, { tags = {}, targetBytes = 0 } = {}) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = 1 + width;
  const raw = Buffer.alloc(height * stride, 0x20);
  for (let y = 0; y < height; y++) raw[y * stride] = 0;
  const idat = zlib.deflateSync(raw, { level: 1 });

  const chunks = [sig, pngChunk('IHDR', ihdr)];
  for (const [k, v] of Object.entries(tags)) {
    chunks.push(pngChunk('tEXt', Buffer.from(`${k}\0${v}`, 'utf8')));
  }
  chunks.push(pngChunk('IDAT', idat));
  const iend = pngChunk('IEND', Buffer.alloc(0));

  if (targetBytes > 0) {
    const baseLen = chunks.reduce((s, c) => s + c.length, 0) + iend.length;
    const needed = targetBytes - baseLen;
    if (needed > 16) {
      const payloadLen = needed - 12; // 4 len + 4 type + 4 crc
      const padKey = Buffer.from('pad\0', 'ascii');
      const padVal = Buffer.alloc(Math.max(0, payloadLen - padKey.length), 0x41);
      chunks.push(pngChunk('tEXt', Buffer.concat([padKey, padVal])));
    }
  }

  chunks.push(iend);
  return Buffer.concat(chunks);
}

// Baseline grayscale JPEG decodable by OpenCV/Pillow for any width/height
export function makeJpegBuffer(width, height) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const dqt = Buffer.concat([
    Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x00]),
    Buffer.alloc(64, 0x10),
  ]);
  const sof0 = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
  ]);
  // DC table 0: code '00' -> diff 0; AC table 0: code '00' -> EOB (0x00)
  const dhtDc = Buffer.from([
    0xff, 0xc4, 0x00, 0x14, 0x00,
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00,
  ]);
  const dhtAc = Buffer.from([
    0xff, 0xc4, 0x00, 0x14, 0x10,
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00,
  ]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
  const mcus = Math.ceil(width / 8) * Math.ceil(height / 8);
  const scanData = Buffer.alloc(Math.ceil((mcus * 4) / 8), 0x00);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, app0, dqt, sof0, dhtDc, dhtAc, sos, scanData, eoi]);
}

export function makeWebpBuffer(width, height) {
  // 46-byte RIFF + WEBP + VP8X + VP8L lossless payload decodable by OpenCV/Pillow
  const buf = Buffer.alloc(46);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(38, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8X', 12, 'ascii');
  buf.writeUInt32LE(10, 16);
  const wm1 = width - 1;
  const hm1 = height - 1;
  buf[24] = wm1 & 0xff;
  buf[25] = (wm1 >> 8) & 0xff;
  buf[26] = (wm1 >> 16) & 0xff;
  buf[27] = hm1 & 0xff;
  buf[28] = (hm1 >> 8) & 0xff;
  buf[29] = (hm1 >> 16) & 0xff;
  buf.write('VP8L', 30, 'ascii');
  buf.writeUInt32LE(8, 34);
  buf[38] = 0x2f;
  const wh = (wm1 & 0x3fff) | ((hm1 & 0x3fff) << 14);
  buf.writeUInt32LE(wh >>> 0, 39);
  buf[43] = 0x88;
  buf[44] = 0x88;
  buf[45] = 0x08;
  return buf;
}

export const makeWebpHeaderBuffer = makeWebpBuffer;

export function makeSvgBuffer() {
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="100%" height="100%"/></svg>', 'utf8');
}

export function makeSpoofedTextBuffer() {
  return Buffer.from('not really a png image just spoofed text', 'utf8');
}

export function makeCorruptPngBuffer() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xde, 0xad, 0xbe, 0xef]);
}

export function inspectImageBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  // PNG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (buf.length < 24 || buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const tags = {};
    let off = 8;
    let sawIdat = false;
    let sawIend = false;
    while (off + 12 <= buf.length) {
      const len = buf.readUInt32BE(off);
      const type = buf.subarray(off + 4, off + 8).toString('ascii');
      if (off + 12 + len > buf.length) return null;
      const data = buf.subarray(off + 8, off + 8 + len);
      if (type === 'tEXt') {
        const nul = data.indexOf(0);
        if (nul > 0) tags[data.subarray(0, nul).toString('utf8')] = data.subarray(nul + 1).toString('utf8');
      } else if (type === 'IDAT') {
        sawIdat = true;
      } else if (type === 'IEND') {
        sawIend = true;
        break;
      }
      off += 12 + len;
    }
    if (!sawIdat || !sawIend || width === 0 || height === 0) return null;
    return { format: 'png', mime: 'image/png', width, height, tags };
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let off = 2;
    while (off + 4 <= buf.length) {
      if (buf[off] !== 0xff) break;
      const marker = buf[off + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8)) {
        off += 2;
        continue;
      }
      const segLen = buf.readUInt16BE(off + 2);
      if (off + 2 + segLen > buf.length) return null;
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buf.readUInt16BE(off + 5);
        const width = buf.readUInt16BE(off + 7);
        return { format: 'jpeg', mime: 'image/jpeg', width, height, tags: {} };
      }
      off += 2 + segLen;
    }
    return null;
  }
  // WebP (require bitstream chunk after VP8X so header-only 30B stubs fail)
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    const chunk = buf.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X' && buf.length >= 46) {
      const nextChunk = buf.subarray(30, 34).toString('ascii');
      if (!['VP8L', 'VP8 ', 'ALPH'].includes(nextChunk)) return null;
      const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { format: 'webp', mime: 'image/webp', width, height, tags: {} };
    }
    if (chunk === 'VP8L' && buf.length >= 25 && buf[20] === 0x2f) {
      const bits = buf.readUInt32LE(21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { format: 'webp', mime: 'image/webp', width, height, tags: {} };
    }
    if (chunk === 'VP8 ' && buf.length >= 30 && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
      const width = buf.readUInt16LE(26) & 0x3fff;
      const height = buf.readUInt16LE(28) & 0x3fff;
      return { format: 'webp', mime: 'image/webp', width, height, tags: {} };
    }
    return null;
  }
  return null;
}

export function detectMime(buf) {
  return inspectImageBuffer(buf)?.mime || 'application/octet-stream';
}

export function readUploadImage(absPath) {
  const buffer = fs.readFileSync(absPath);
  const info = inspectImageBuffer(buffer);
  const mime = info?.mime || 'image/png';
  const base = path.basename(absPath);
  const filename = mime === 'image/jpeg' ? base.replace(/\.(png|webp)$/i, '.jpg') : base;
  return { buffer, mime, filename, info };
}

export function loadFixture(filename) {
  return readUploadImage(path.join(REPO_ROOT, 'ocr-engine', 'tests', 'fixtures', filename));
}

export function getOcrEnginePython() {
  const win = path.join(REPO_ROOT, 'ocr-engine', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(win)) return win;
  return path.join(REPO_ROOT, 'ocr-engine', '.venv', 'bin', 'python');
}

export function runClientScript(relBin, args = [], { timeout = 120000 } = {}) {
  const clientDir = path.join(REPO_ROOT, 'client');
  const binPath = path.join(clientDir, 'node_modules', ...relBin.split('/'));
  return execFileSync(process.execPath, [binPath, ...args], {
    cwd: clientDir,
    encoding: 'utf8',
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function validateAspectRatioAndResolution(width, height) {
  if (width < 1280 || height < 720) {
    return { ok: false, status: 400, code: 'LOW_RESOLUTION', message: `Resolution ${width}x${height} below 1280x720` };
  }
  const ratio = width / height;
  const r16_9 = 16 / 9;
  const r21_9 = 21 / 9;
  const ok16 = Math.abs(ratio - r16_9) / r16_9 <= 0.02;
  const ok21 = Math.abs(ratio - r21_9) / r21_9 <= 0.02;
  if (!ok16 && !ok21) {
    return { ok: false, status: 400, code: 'UNSUPPORTED_RATIO', message: `Unsupported aspect ratio ${ratio.toFixed(4)}` };
  }
  const preset = ok21 ? '21:9' : height >= 1440 ? 'QHD' : 'FHD';
  return { ok: true, preset };
}

// --- Multipart Request & HTTP Helpers ---

export async function postMultipart(url, { files = [], headers = {}, signal } = {}) {
  const form = new FormData();
  for (const item of files) {
    const blob = new Blob([item.buffer], { type: item.mime || 'image/png' });
    form.append(item.field, blob, item.filename || `${item.field}.png`);
  }
  const t0 = performance.now();
  const res = await fetch(url, { method: 'POST', body: form, headers, signal });
  const elapsedMs = performance.now() - t0;
  const rawText = await res.text();
  let body = null;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = null;
  }
  return { status: res.status, headers: res.headers, body, rawText, elapsedMs };
}

export async function getJson(url, { headers = {}, signal } = {}) {
  const t0 = performance.now();
  const res = await fetch(url, { method: 'GET', headers, signal });
  const elapsedMs = performance.now() - t0;
  const rawText = await res.text();
  let body = null;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = null;
  }
  return { status: res.status, headers: res.headers, body, rawText, elapsedMs };
}

export async function postBackendLive(url, opts = {}) {
  let res = await postMultipart(url, opts);
  if (res.status === 429 && res.body?.code === 'RATE_LIMITED' && process.env.E2E_FAIL_ON_RATE_LIMIT !== '1') {
    const resetSec = Number(res.headers.get('ratelimit-reset') || '60');
    const waitMs = Math.min(65, Math.max(1, Number.isFinite(resetSec) ? resetSec : 60) + 1) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    res = await postMultipart(url, opts);
  }
  return res;
}

// --- Multipart Buffer Parser for Ephemeral Contract Server ---

function parseMultipart(contentType, rawBody) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return [];
  const boundary = `--${(m[1] || m[2]).trim()}`;
  const delim = Buffer.from(boundary, 'ascii');
  const crlf = Buffer.from('\r\n\r\n', 'ascii');
  const parts = [];
  let pos = rawBody.indexOf(delim);
  while (pos !== -1) {
    pos += delim.length;
    if (rawBody[pos] === 0x2d && rawBody[pos + 1] === 0x2d) break;
    if (rawBody[pos] === 0x0d && rawBody[pos + 1] === 0x0a) pos += 2;
    const hdrEnd = rawBody.indexOf(crlf, pos);
    if (hdrEnd === -1) break;
    const hdrStr = rawBody.subarray(pos, hdrEnd).toString('utf8');
    const dataStart = hdrEnd + 4;
    const nextDelim = rawBody.indexOf(delim, dataStart);
    if (nextDelim === -1) break;
    let dataEnd = nextDelim;
    if (rawBody[dataEnd - 2] === 0x0d && rawBody[dataEnd - 1] === 0x0a) dataEnd -= 2;
    const nameMatch = /name="([^"]+)"/i.exec(hdrStr);
    const fileMatch = /filename="([^"]+)"/i.exec(hdrStr);
    const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(hdrStr);
    parts.push({
      field: nameMatch ? nameMatch[1] : '',
      filename: fileMatch ? fileMatch[1] : '',
      mime: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
      buffer: rawBody.subarray(dataStart, dataEnd),
    });
    pos = nextDelim;
  }
  return parts;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
    req.on('close', () => {
      if (!req.complete) reject(new Error('CLIENT_ABORTED'));
    });
  });
}

function sendJson(res, status, payload) {
  if (res.writableEnded || res.destroyed) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

// --- Ephemeral 127.0.0.1:0 Dual-Tier Contract Server ---

export async function createContractHarness(initialOpts = {}) {
  const opts = {
    engineToken: OCR_ENGINE_TOKEN,
    engineDown: false,
    engineMalformedJson: false,
    engineDelayMs: 0,
    reloadBackendReachable: true,
    concurrency: 2,
    maxQueue: 4,
    queueTimeoutMs: 2000,
    engineTimeoutMs: 2000,
    rateLimitMax: 10,
    rateLimitWindowMs: 60000,
    ...initialOpts,
  };

  const metrics = {
    inFlight: 0,
    maxObservedInFlight: 0,
    queued: 0,
    abortedUpstream: 0,
    engineCalls: 0,
    lastReceivedParts: [],
  };

  const engineServer = http.createServer(async (req, res) => {
    if (opts.engineDown) {
      res.destroy();
      return;
    }

    if (req.method === 'GET' && req.url === '/healthz') {
      return sendJson(res, 200, {
        ok: true,
        version: '1.0.0',
        modelsLoaded: true,
        studentNamesCount: 185,
      });
    }

    if (req.method === 'POST' && req.url === '/v1/students/reload') {
      const tok = req.headers['x-engine-token'];
      if (!tok || tok !== opts.engineToken) {
        return sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Engine-Token' });
      }
      return sendJson(res, 200, {
        ok: true,
        count: 185,
        source: opts.reloadBackendReachable ? 'backend' : 'bundled',
      });
    }

    if (req.url === '/v1/recognize' && req.method !== 'POST') {
      return sendJson(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
    }

    if (req.method === 'POST' && req.url === '/v1/recognize') {
      metrics.engineCalls += 1;
      const tok = req.headers['x-engine-token'];
      if (!tok || tok !== opts.engineToken) {
        return sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Engine-Token' });
      }
      if (opts.engineMalformedJson) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{broken-json');
        return;
      }

      let rawBody;
      try {
        rawBody = await readRawBody(req);
      } catch {
        metrics.abortedUpstream += 1;
        return;
      }

      let aborted = false;
      res.on('close', () => {
        if (!res.writableEnded) {
          aborted = true;
          metrics.abortedUpstream += 1;
        }
      });

      if (opts.engineDelayMs > 0) {
        await new Promise((r) => setTimeout(r, opts.engineDelayMs));
      }
      if (aborted) return;

      const parts = parseMultipart(req.headers['content-type'], rawBody);
      metrics.lastReceivedParts = parts.map((p) => ({
        field: p.field,
        filename: p.filename,
        mime: p.mime,
        byteLength: p.buffer.length,
        buffer: Buffer.from(p.buffer),
      }));
      if (parts.length > 5) {
        return sendJson(res, 400, { code: 'INVALID_SLOT', message: 'Too many files (max 5)' });
      }

      const bySlot = {};
      for (const part of parts) {
        if (!ALLOWED_SLOTS.has(part.field)) {
          return sendJson(res, 400, { code: 'INVALID_SLOT', message: `Invalid slot: ${part.field}` });
        }
        if (part.buffer.length > MAX_FILE_BYTES) {
          return sendJson(res, 400, { code: 'FILE_TOO_LARGE', message: 'File exceeds 8MB limit' });
        }
        const info = inspectImageBuffer(part.buffer);
        if (!info || !['image/png', 'image/jpeg', 'image/webp'].includes(part.mime)) {
          return sendJson(res, 400, { code: 'BAD_IMAGE', message: `Corrupt or invalid image in ${part.field}` });
        }
        const geo = validateAspectRatioAndResolution(info.width, info.height);
        if (!geo.ok) {
          return sendJson(res, geo.status, { code: geo.code, message: geo.message });
        }
        bySlot[part.field] = { part, info, geo };
      }

      if (!bySlot.main) {
        return sendJson(res, 400, { code: 'MISSING_MAIN', message: 'main screenshot is required' });
      }

      const scenes = {};
      for (const [slot, entry] of Object.entries(bySlot)) {
        const expected = EXPECTED_SCENES[slot];
        const detected = entry.info.tags.scene || expected;
        if (detected !== expected) {
          return sendJson(res, 422, {
            code: 'SCENE_MISMATCH',
            message: `${slot} slot expected ${expected} but detected ${detected}`,
            detail: { slot, detected, expected },
          });
        }
        scenes[slot] = detected;
      }

      // Check activeSlot duplicate across equip1..3
      const seenActiveSlots = new Map();
      for (const slot of ['equip1', 'equip2', 'equip3']) {
        if (!bySlot[slot]) continue;
        const defaultNum = Number(slot.replace('equip', ''));
        const activeSlot = Number(bySlot[slot].info.tags.activeSlot || defaultNum);
        if (seenActiveSlots.has(activeSlot)) {
          return sendJson(res, 422, {
            code: 'SLOT_DUPLICATE',
            message: `Duplicate active equipment slot ${activeSlot}`,
            detail: { slot, activeSlot, conflictingWith: seenActiveSlots.get(activeSlot) },
          });
        }
        seenActiveSlots.set(activeSlot, slot);
      }

      // Build response from success_200 mock + merge rules
      const base = loadMock('success_200.json');
      const mainTags = bySlot.main.info.tags;
      const data = structuredClone(base.data);
      const fieldSources = {
        'equipments[0]': 'main',
        'equipments[1]': 'main',
        'equipments[2]': 'main',
        favoriteItem: 'main',
      };
      const needsReview = [];

      if (mainTags.case === 'needs_review') {
        data.bondRank = null;
        needsReview.push('bondRank');
      }
      if (mainTags.case === 'unmatched_name') {
        data.studentName = '알수없는학생';
        needsReview.push('studentName');
      }
      if (mainTags.case === 'unequipped_weapon') {
        data.weapon = { unequipped: true, starGrade: null, level: null };
      }

      // Low-precision main equipment unless overwritten by modal
      data.equipments[0] = { slot: 1, unequipped: false, tier: 8, level: null };
      data.equipments[1] = { slot: 2, unequipped: false, tier: 8, level: null };
      data.equipments[2] = { slot: 3, unequipped: false, tier: 8, level: null };
      data.favoriteItem = { unequipped: false, tier: 1 };

      for (const slot of ['equip1', 'equip2', 'equip3']) {
        if (!bySlot[slot]) continue;
        const activeSlot = Number(bySlot[slot].info.tags.activeSlot || slot.replace('equip', ''));
        data.equipments[activeSlot - 1] = { slot: activeSlot, unequipped: false, tier: 9, level: 65 };
        fieldSources[`equipments[${activeSlot - 1}]`] = slot;
      }

      for (let i = 0; i < 3; i++) {
        if (fieldSources[`equipments[${i}]`] === 'main' && !data.equipments[i].unequipped) {
          needsReview.push(`equipments[${i}].level`);
        }
      }

      if (bySlot.favorite) {
        const favTier = Number(bySlot.favorite.info.tags.favTier || 2);
        data.favoriteItem = { unequipped: false, tier: Math.max(1, Math.min(2, favTier)) };
        fieldSources.favoriteItem = 'favorite';
      } else if (mainTags.case === 'no_favorite') {
        data.favoriteItem = { unequipped: true, tier: null };
      }

      const meta = {
        engine: 'plana-ocr@1.0.0',
        preset: bySlot.main.geo.preset,
        scenes,
        fieldSources,
        needsReview: [...new Set(needsReview)],
        studentMatch: {
          raw: data.studentName,
          score: mainTags.case === 'unmatched_name' ? 0.55 : 1.0,
        },
        elapsedMs: 12,
      };

      return sendJson(res, 200, { data, meta });
    }

    return sendJson(res, 404, { code: 'NOT_FOUND', message: 'Not found' });
  });

  engineServer.keepAliveTimeout = 120000;
  engineServer.headersTimeout = 125000;
  await new Promise((resolve) => engineServer.listen(0, '127.0.0.1', resolve));
  const engineAddr = engineServer.address();
  const engineUrl = `http://127.0.0.1:${engineAddr.port}`;

  // Queue & Rate Limiter state for Backend Proxy
  const rateBuckets = new Map();
  const queue = [];

  function runQueue() {
    while (metrics.inFlight < opts.concurrency && queue.length > 0) {
      const task = queue.shift();
      metrics.queued = queue.length;
      if (task.settled) continue;
      clearTimeout(task.waitTimer);
      metrics.inFlight += 1;
      if (metrics.inFlight > metrics.maxObservedInFlight) {
        metrics.maxObservedInFlight = metrics.inFlight;
      }
      task.run().finally(() => {
        metrics.inFlight -= 1;
        runQueue();
      });
    }
  }

  const backendServer = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/api/ocr/status') {
      try {
        const r = await fetch(`${engineUrl}/healthz`, { signal: AbortSignal.timeout(1500) });
        const body = await r.json();
        return sendJson(res, 200, {
          success: true,
          engine: 'plana-ocr',
          version: body.version || '1.0.0',
          healthy: Boolean(r.ok && body.ok),
          metrics: { inFlight: metrics.inFlight, queued: metrics.queued, maxConcurrent: opts.concurrency },
        });
      } catch {
        return sendJson(res, 200, {
          success: true,
          engine: 'plana-ocr',
          version: '1.0.0',
          healthy: false,
          metrics: { inFlight: metrics.inFlight, queued: metrics.queued, maxConcurrent: opts.concurrency },
        });
      }
    }

    if (req.method === 'POST' && req.url === '/api/ocr') {
      // Rate limiter (optionalAuth userId key or IP)
      const authHeader = req.headers.authorization || '';
      const key = authHeader.startsWith('Bearer ') ? `user:${authHeader.slice(7)}` : `ip:${req.socket.remoteAddress || '127.0.0.1'}`;
      const now = Date.now();
      const hits = (rateBuckets.get(key) || []).filter((ts) => now - ts < opts.rateLimitWindowMs);
      if (hits.length >= opts.rateLimitMax) {
        return sendJson(res, 429, { success: false, code: 'RATE_LIMITED', error: 'Rate limit exceeded (10/min)' });
      }
      hits.push(now);
      rateBuckets.set(key, hits);

      let rawBody;
      try {
        rawBody = await readRawBody(req);
      } catch {
        return sendJson(res, 499, { success: false, code: 'CLIENT_ABORTED', error: 'Client aborted request' });
      }

      const parts = parseMultipart(req.headers['content-type'], rawBody);
      metrics.lastReceivedParts = parts.map((p) => ({
        field: p.field,
        filename: p.filename,
        mime: p.mime,
        byteLength: p.buffer.length,
        buffer: Buffer.from(p.buffer),
      }));
      if (parts.length > 5) {
        return sendJson(res, 400, { success: false, code: 'INVALID_SLOT', error: 'Too many files (max 5)' });
      }
      let hasMain = false;
      for (const part of parts) {
        if (!ALLOWED_SLOTS.has(part.field)) {
          return sendJson(res, 400, { success: false, code: 'INVALID_SLOT', error: `Invalid slot: ${part.field}` });
        }
        if (part.field === 'main') hasMain = true;
        if (part.buffer.length > MAX_FILE_BYTES) {
          return sendJson(res, 400, { success: false, code: 'FILE_TOO_LARGE', error: 'File exceeds 8MB limit' });
        }
        const info = inspectImageBuffer(part.buffer);
        if (!info || !['image/png', 'image/jpeg', 'image/webp'].includes(part.mime)) {
          return sendJson(res, 400, { success: false, code: 'BAD_IMAGE', error: `Invalid image in ${part.field}` });
        }
        const geo = validateAspectRatioAndResolution(info.width, info.height);
        if (!geo.ok) {
          return sendJson(res, geo.status, { success: false, code: geo.code, error: geo.message });
        }
      }
      if (!hasMain) {
        return sendJson(res, 400, { success: false, code: 'MISSING_MAIN', error: 'main screenshot is required' });
      }

      if (metrics.inFlight >= opts.concurrency && queue.length >= opts.maxQueue) {
        return sendJson(res, 429, { success: false, code: 'QUEUE_FULL', error: 'OCR queue is full' });
      }

      const abortCtl = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) {
          abortCtl.abort(new Error('CLIENT_ABORTED'));
        }
      });

      const task = {
        settled: false,
        waitTimer: null,
        run: async () => {
          if (abortCtl.signal.aborted) {
            return sendJson(res, 499, { success: false, code: 'CLIENT_ABORTED', error: 'Client aborted request' });
          }
          const form = new FormData();
          for (const p of parts) {
            form.append(p.field, new Blob([p.buffer], { type: p.mime }), p.filename || `${p.field}.png`);
          }
          const timeoutCtl = AbortSignal.timeout(opts.engineTimeoutMs);
          const combinedSignal = AbortSignal.any([abortCtl.signal, timeoutCtl]);
          try {
            const upstream = await fetch(`${engineUrl}/v1/recognize`, {
              method: 'POST',
              headers: { 'X-Engine-Token': opts.engineToken },
              body: form,
              signal: combinedSignal,
            });
            const text = await upstream.text();
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              return sendJson(res, 503, { success: false, code: 'ENGINE_UNAVAILABLE', error: 'Invalid JSON from OCR engine' });
            }
            if (upstream.ok) {
              if (!validateSuccessResponse(parsed)) {
                return sendJson(res, 503, { success: false, code: 'ENGINE_UNAVAILABLE', error: 'OCR engine response violated schema' });
              }
              return sendJson(res, 200, { success: true, data: parsed.data, meta: parsed.meta });
            }
            return sendJson(res, upstream.status, {
              success: false,
              code: parsed.code || 'ENGINE_ERROR',
              error: parsed.message || 'OCR engine error',
              ...(parsed.detail ? { detail: parsed.detail } : {}),
            });
          } catch (err) {
            if (abortCtl.signal.aborted) {
              return sendJson(res, 499, { success: false, code: 'CLIENT_ABORTED', error: 'Client aborted request' });
            }
            if (timeoutCtl.aborted || err?.name === 'TimeoutError') {
              return sendJson(res, 504, { success: false, code: 'ENGINE_TIMEOUT', error: 'OCR engine timed out' });
            }
            return sendJson(res, 503, { success: false, code: 'ENGINE_UNAVAILABLE', error: 'OCR engine unavailable' });
          }
        },
      };

      task.waitTimer = setTimeout(() => {
        task.settled = true;
        const idx = queue.indexOf(task);
        if (idx !== -1) queue.splice(idx, 1);
        metrics.queued = queue.length;
        sendJson(res, 504, { success: false, code: 'QUEUE_TIMEOUT', error: 'OCR queue wait timed out' });
      }, opts.queueTimeoutMs);

      queue.push(task);
      metrics.queued = queue.length;
      runQueue();
      return;
    }

    return sendJson(res, 404, { success: false, code: 'NOT_FOUND', error: 'Not found' });
  });

  backendServer.keepAliveTimeout = 120000;
  backendServer.headersTimeout = 125000;
  await new Promise((resolve) => backendServer.listen(0, '127.0.0.1', resolve));
  const backendAddr = backendServer.address();
  const backendUrl = `http://127.0.0.1:${backendAddr.port}`;

  return {
    engineUrl,
    backendUrl,
    opts,
    metrics,
    resetRateLimits() {
      rateBuckets.clear();
    },
    async close() {
      backendServer.closeIdleConnections?.();
      engineServer.closeIdleConnections?.();
      await Promise.all([
        new Promise((r) => {
          backendServer.close(r);
          backendServer.closeAllConnections?.();
        }),
        new Promise((r) => {
          engineServer.close(r);
          engineServer.closeAllConnections?.();
        }),
      ]);
    },
  };
}

// --- Filesystem & Repository Hygiene Helpers ---

export function snapshotDirTree(relDir, excludeDirs = new Set(['.venv', '__pycache__', '.pytest_cache', 'node_modules', '.git'])) {
  const root = path.join(REPO_ROOT, relDir);
  if (!fs.existsSync(root)) return [];
  const entries = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (excludeDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const s = fs.statSync(full);
        entries.push(`${path.relative(root, full)}:${s.size}:${s.mtimeMs}`);
      }
    }
  }
  walk(root);
  return entries.sort();
}

export function snapshotProtectedPaths() {
  const result = {};
  for (const rel of PROTECTED_PATHS) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) {
      result[rel] = { exists: false };
      continue;
    }
    const stat = fs.statSync(abs);
    if (stat.isFile()) {
      result[rel] = { exists: true, size: stat.size, mtimeMs: stat.mtimeMs };
    } else {
      const files = fs.readdirSync(abs).sort().map((f) => {
        const s = fs.statSync(path.join(abs, f));
        return `${f}:${s.size}:${s.mtimeMs}`;
      });
      result[rel] = { exists: true, files };
    }
  }
  return result;
}

export function scanFilesForPatterns(dirs, patterns, options = {}) {
  const defaultExclude = new Set(['node_modules', '.next', '.venv', '__pycache__', '.git', 'data', 'uploads']);
  const excludeDirs = options instanceof Set ? options : (options.excludeDirs || defaultExclude);
  const extensions = options instanceof Set ? null : (options.extensions || null);
  const extRegex = extensions
    ? new RegExp(`(${extensions.map((e) => e.replace('.', '\\.')).join('|')})$`, 'i')
    : /\.(ts|tsx|js|mjs|cjs|py|md|json|bat|ps1|example)$/i;

  const hits = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (excludeDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (extRegex.test(entry.name) || (!extensions && entry.name === '.env.example')) {
        const content = fs.readFileSync(full, 'utf8');
        for (const pat of patterns) {
          if (pat.test(content)) {
            hits.push({ file: path.relative(REPO_ROOT, full), pattern: pat.source });
          }
        }
      }
    }
  }
  for (const d of dirs) walk(path.join(REPO_ROOT, d));
  return hits;
}

export function runGit(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}
