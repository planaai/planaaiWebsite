import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO_ROOT,
  E2E_LIVE,
  OCR_ENGINE_URL,
  BACKEND_URL,
  OCR_ENGINE_TOKEN,
  MAX_FILE_BYTES,
  requireLive,
  requireStrict,
  validateSuccessResponse,
  validateErrorResponse,
  loadMock,
  loadFixture,
  assertValidSuccess,
  assertValidError,
  makePngBuffer,
  makeSvgBuffer,
  makeSpoofedTextBuffer,
  makeCorruptPngBuffer,
  postMultipart,
  postBackendLive,
  runClientScript,
  createContractHarness,
  snapshotProtectedPaths,
  scanFilesForPatterns,
  runGit,
} from './helpers.mjs';

const parserMod = await import(
  pathToFileURL(path.join(REPO_ROOT, 'client', 'src', 'lib', 'ocr', 'studentOcrParser.ts')).href
);

let harness;
let engineBase;
let backendBase;

before(async () => {
  harness = await createContractHarness({ rateLimitMax: 100 });
  engineBase = E2E_LIVE ? OCR_ENGINE_URL : harness.engineUrl;
  backendBase = E2E_LIVE ? BACKEND_URL : harness.backendUrl;
});

after(async () => {
  await harness?.close();
});

describe('Tier 2 — Boundaries, Corner Cases & Error Codes (F1..F11)', () => {
  // F1: Schema boundaries
  test('F1.B1: level boundaries (1 and 90 pass; 0 and 91 fail schema)', () => {
    for (const lv of [1, 90]) {
      const p = loadMock('success_200.json');
      p.data.level = lv;
      assert.equal(validateSuccessResponse(p), true);
    }
    for (const lv of [0, 91]) {
      const p = loadMock('success_200.json');
      p.data.level = lv;
      assert.equal(validateSuccessResponse(p), false);
    }
  });

  test('F1.B2: starGrade (1..5) and bondRank (1..100 or null) boundaries', () => {
    for (const [star, bond] of [[1, 1], [5, 100], [3, null]]) {
      const p = loadMock('success_200.json');
      p.data.starGrade = star;
      p.data.bondRank = bond;
      assert.equal(validateSuccessResponse(p), true);
    }
    for (const [star, bond] of [[0, 10], [6, 10], [5, 0], [5, 101]]) {
      const p = loadMock('success_200.json');
      p.data.starGrade = star;
      p.data.bondRank = bond;
      assert.equal(validateSuccessResponse(p), false);
    }
  });

  test('F1.B3: skill upper bounds and unequipped weapon if/then null constraint', () => {
    const badEx = loadMock('success_200.json');
    badEx.data.skills.ex = 6;
    assert.equal(validateSuccessResponse(badEx), false);

    const badNormal = loadMock('success_200.json');
    badNormal.data.skills.normal = 11;
    assert.equal(validateSuccessResponse(badNormal), false);

    const badWeapon = loadMock('success_200.json');
    badWeapon.data.weapon = { unequipped: true, starGrade: 3, level: null };
    assert.equal(validateSuccessResponse(badWeapon), false);
  });

  test('F1.B4: equipments fixed 3-element tuple rejects wrong length or swapped slots', () => {
    const shortEq = loadMock('success_200.json');
    shortEq.data.equipments = shortEq.data.equipments.slice(0, 2);
    assert.equal(validateSuccessResponse(shortEq), false);

    const swapped = loadMock('success_200.json');
    [swapped.data.equipments[0], swapped.data.equipments[1]] = [swapped.data.equipments[1], swapped.data.equipments[0]];
    assert.equal(validateSuccessResponse(swapped), false);
  });

  test('F1.B5: needsReview uniqueness and ErrorResponse uppercase code regex', () => {
    const dupReview = loadMock('needs_review_200.json');
    dupReview.meta.needsReview = ['bondRank', 'bondRank'];
    assert.equal(validateSuccessResponse(dupReview), false);

    const badErr = { code: 'bad_lowercase', message: 'fail' };
    assert.equal(validateErrorResponse(badErr), false);
  });

  // F2: Resolution & Aspect Ratio boundaries (routed to engineBase so ocrLimiter is unaffected)
  test('F2.B1: exact minimum resolution 1280x720 passes geometry; 1279x720 fails with 400 LOW_RESOLUTION', async () => {
    const okRes = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(1280, 720), filename: 'min.png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    if (E2E_LIVE) {
      assert.notEqual(okRes.status, 400);
      assert.notEqual(okRes.body?.code, 'LOW_RESOLUTION');
    } else {
      assert.equal(okRes.status, 200);
    }

    const lowRes = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(1279, 720), filename: 'loww.png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(lowRes.status, 400);
    assertValidError(lowRes.body);
    assert.equal(lowRes.body.code, 'LOW_RESOLUTION');
  });

  test('F2.B2: 1280x719 fails with 400 LOW_RESOLUTION', async () => {
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(1280, 719), filename: 'lowh.png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 400);
    assertValidError(res.body);
    assert.equal(res.body.code, 'LOW_RESOLUTION');
  });

  test('F2.B3: 16:9 +-2% boundary (1882x1080 & 1958x1080 pass geometry; 1880x1080 & 1960x1080 fail 400 UNSUPPORTED_RATIO)', async () => {
    for (const [w, h] of [[1882, 1080], [1958, 1080]]) {
      const passRes = await postMultipart(`${engineBase}/v1/recognize`, {
        files: [{ field: 'main', buffer: makePngBuffer(w, h), filename: `${w}x${h}.png` }],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      if (E2E_LIVE) {
        assert.notEqual(passRes.status, 400, `${w}x${h} should pass 16:9 +-2%`);
        assert.notEqual(passRes.body?.code, 'UNSUPPORTED_RATIO');
      } else {
        assert.equal(passRes.status, 200, `${w}x${h} should pass`);
      }
    }

    for (const [w, h] of [[1880, 1080], [1960, 1080]]) {
      const failRes = await postMultipart(`${engineBase}/v1/recognize`, {
        files: [{ field: 'main', buffer: makePngBuffer(w, h), filename: `${w}x${h}.png` }],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(failRes.status, 400, `${w}x${h} should fail 16:9 +-2%`);
      assertValidError(failRes.body);
      assert.equal(failRes.body.code, 'UNSUPPORTED_RATIO');
    }
  });

  test('F2.B4: 4:3 (1600x1200) and portrait (1280x1920) fail with 400 UNSUPPORTED_RATIO', async () => {
    for (const [w, h] of [[1600, 1200], [1280, 1920]]) {
      const res = await postMultipart(`${engineBase}/v1/recognize`, {
        files: [{ field: 'main', buffer: makePngBuffer(w, h), filename: `${w}x${h}.png` }],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(res.status, 400);
      assertValidError(res.body);
      assert.equal(res.body.code, 'UNSUPPORTED_RATIO');
    }
  });

  test('F2.B5: releaseLevel (1..25) and favoriteItem.tier (1..2) bounds enforced by schema', () => {
    const p = loadMock('success_200.json');
    p.data.stats.hp.releaseLevel = 26;
    assert.equal(validateSuccessResponse(p), false);

    const p2 = loadMock('success_200.json');
    p2.data.favoriteItem.tier = 3;
    assert.equal(validateSuccessResponse(p2), false);
  });

  // F3: Engine Endpoint & Auth boundaries
  test('F3.B1: POST /v1/recognize without X-Engine-Token returns 401/403', async () => {
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(1920, 1080), filename: 'main.png' }],
    });
    assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    if (res.body?.code) assertValidError(res.body);
  });

  test('F3.B2: POST /v1/recognize with wrong X-Engine-Token returns 401/403', async () => {
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(1920, 1080), filename: 'main.png' }],
      headers: { 'X-Engine-Token': 'wrong-token-xyz' },
    });
    assert.ok([401, 403].includes(res.status));
    if (res.body?.code) assertValidError(res.body);
  });

  test('F3.B3: POST /v1/students/reload without X-Engine-Token returns 401/403', async () => {
    const res = await fetch(`${engineBase}/v1/students/reload`, { method: 'POST' });
    assert.ok([401, 403].includes(res.status));
  });

  test('F3.B4: POST /v1/students/reload with wrong X-Engine-Token returns 401/403', async () => {
    const res = await fetch(`${engineBase}/v1/students/reload`, {
      method: 'POST',
      headers: { 'X-Engine-Token': 'bad-secret' },
    });
    assert.ok([401, 403].includes(res.status));
  });

  test('F3.B5: empty X-Engine-Token is rejected (401/403) and GET /v1/recognize returns 405', async () => {
    const emptyTok = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(1920, 1080), filename: 'main.png' }],
      headers: { 'X-Engine-Token': '' },
    });
    assert.ok([401, 403].includes(emptyTok.status));

    const getMethod = await fetch(`${engineBase}/v1/recognize`, {
      method: 'GET',
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(getMethod.status, 405);
  });

  // F4: Magic Bytes, Corrupt Image, File Size & Security
  test('F4.B1: spoofed .png file containing plain text bytes fails with 400 BAD_IMAGE', async () => {
    const res = await postBackendLive(`${backendBase}/api/ocr`, {
      files: [{ field: 'main', buffer: makeSpoofedTextBuffer(), filename: 'spoof.png', mime: 'image/png' }],
    });
    assert.equal(res.status, 400);
    assertValidError(res.body, { requireSuccessFlag: true });
    assert.equal(res.body.code, 'BAD_IMAGE');
  });

  test('F4.B2: SVG payload disguised as image/png fails with 400 BAD_IMAGE', async () => {
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: makeSvgBuffer(), filename: 'xss.png', mime: 'image/png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 400);
    assertValidError(res.body);
    assert.equal(res.body.code, 'BAD_IMAGE');
  });

  test('F4.B3: truncated/corrupt PNG bytes fail with 400 BAD_IMAGE', async () => {
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: makeCorruptPngBuffer(), filename: 'corrupt.png', mime: 'image/png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 400);
    assertValidError(res.body);
    assert.equal(res.body.code, 'BAD_IMAGE');
  });

  test('F4.B4: exact 8MB passes while 8MB + 1 byte fails with 400 FILE_TOO_LARGE', async () => {
    const exact = makePngBuffer(1280, 720, { targetBytes: MAX_FILE_BYTES });
    assert.equal(exact.length, MAX_FILE_BYTES);
    const okRes = await postMultipart(`${harness.backendUrl}/api/ocr`, {
      files: [{ field: 'main', buffer: exact, filename: 'exact8mb.png' }],
    });
    assert.equal(okRes.status, 200);

    const over = makePngBuffer(1280, 720, { targetBytes: MAX_FILE_BYTES + 1 });
    assert.equal(over.length, MAX_FILE_BYTES + 1);
    const failRes = await postMultipart(`${harness.backendUrl}/api/ocr`, {
      files: [{ field: 'main', buffer: over, filename: 'over8mb.png' }],
    });
    assert.equal(failRes.status, 400);
    assert.equal(failRes.body.code, 'FILE_TOO_LARGE');
  });

  test('F4.B5: ocr-engine scripts & env bind strictly to 127.0.0.1 (--workers 1) and keep OCR_AUDIT_DIR unset by default', (t) => {
    if (!requireStrict(t)) return;
    const ps1 = fs.readFileSync(path.join(REPO_ROOT, 'ocr-engine', 'start_ocr_engine.ps1'), 'utf8');
    const bat = fs.readFileSync(path.join(REPO_ROOT, 'ocr-engine', 'start_ocr_engine.bat'), 'utf8');
    assert.match(ps1, /--host\s+127\.0\.0\.1/);
    assert.match(ps1, /--workers\s+1\b/);
    assert.match(bat, /--host\s+127\.0\.0\.1/);
    assert.match(bat, /--workers\s+1\b/);

    const engineEnvEx = fs.readFileSync(path.join(REPO_ROOT, 'ocr-engine', '.env.example'), 'utf8');
    assert.match(engineEnvEx, /^OCR_AUDIT_DIR=\s*$/m);
    const backendEnvEx = fs.readFileSync(path.join(REPO_ROOT, 'backend', '.env.example'), 'utf8');
    assert.match(backendEnvEx, /OCR_ENGINE_URL="?http:\/\/127\.0\.0\.1:8090"?/);

    if (E2E_LIVE) {
      assert.equal(new URL(OCR_ENGINE_URL).hostname, '127.0.0.1');
      assert.equal(Boolean(process.env.OCR_AUDIT_DIR), false);
    }
  });

  // F5: Scene/Slot Guard & Missing Main
  test('F5.B1: student_info uploaded to equip2 triggers 422 SCENE_MISMATCH with required detail', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' };
    const wrong = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'e2.png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [
        { field: 'main', ...main },
        { field: 'equip2', ...wrong },
      ],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 422);
    assertValidError(res.body);
    assert.equal(res.body.code, 'SCENE_MISMATCH');
    assert.equal(res.body.detail.slot, 'equip2');
    assert.equal(res.body.detail.detected, 'student_info');
  });

  test('F5.B2: equipment_modal uploaded to main triggers 422 SCENE_MISMATCH', async () => {
    const wrongMain = E2E_LIVE
      ? loadFixture('equipment_modal.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal' } }), filename: 'main.png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', ...wrongMain }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 422);
    assertValidError(res.body);
    assert.equal(res.body.code, 'SCENE_MISMATCH');
    assert.equal(res.body.detail.slot, 'main');
    assert.equal(res.body.detail.detected, 'equipment_modal');
  });

  test('F5.B3: favorite_popup in equip1 and equipment_modal in favorite trigger 422 SCENE_MISMATCH', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' };
    const fav = E2E_LIVE
      ? loadFixture('favorite_popup.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'favorite_popup' } }), filename: 'e1.png' };
    const equip = E2E_LIVE
      ? loadFixture('equipment_modal.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal' } }), filename: 'fav.png' };

    const r1 = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [
        { field: 'main', ...main },
        { field: 'equip1', ...fav },
      ],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(r1.status, 422);
    assert.equal(r1.body.code, 'SCENE_MISMATCH');
    assert.equal(r1.body.detail.slot, 'equip1');

    const r2 = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [
        { field: 'main', ...main },
        { field: 'favorite', ...equip },
      ],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(r2.status, 422);
    assert.equal(r2.body.code, 'SCENE_MISMATCH');
    assert.equal(r2.body.detail.slot, 'favorite');
  });

  test('F5.B4: duplicate activeSlot across equip1 & equip2 triggers 422 SLOT_DUPLICATE', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' };
    const e1 = E2E_LIVE
      ? loadFixture('equipment_modal.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '1' } }), filename: 'e1.png' };
    const e2 = E2E_LIVE
      ? loadFixture('equipment_modal.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '1' } }), filename: 'e2.png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [
        { field: 'main', ...main },
        { field: 'equip1', ...e1 },
        { field: 'equip2', ...e2 },
      ],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 422);
    assertValidError(res.body);
    assert.equal(res.body.code, 'SLOT_DUPLICATE');
    assert.equal(res.body.detail.slot, 'equip2');
    assert.equal(res.body.detail.conflictingWith, 'equip1');
  });

  test('F5.B5: omitting main (equip1 only) fails with 400 MISSING_MAIN', async () => {
    const equip = E2E_LIVE
      ? loadFixture('equipment_modal.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal' } }), filename: 'e1.png' };
    const res = await postBackendLive(`${backendBase}/api/ocr`, {
      files: [{ field: 'equip1', ...equip }],
    });
    assert.equal(res.status, 400);
    assertValidError(res.body, { requireSuccessFlag: true });
    assert.equal(res.body.code, 'MISSING_MAIN');
  });

  // F6: NeedsReview, Match Score & Determinism Boundaries
  test('F6.B1: unmatched student name keeps raw name and appends studentName to needsReview', async () => {
    const res = await postMultipart(`${harness.engineUrl}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info', case: 'unmatched_name' } }), filename: 'main.png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.meta.needsReview.includes('studentName'));
    assert.ok(res.body.meta.studentMatch.score < 1.0);
  });

  test('F6.B2: meta.studentMatch.score boundary [0..1] enforced by schema', () => {
    const ok0 = loadMock('success_200.json');
    ok0.meta.studentMatch.score = 0;
    assert.equal(validateSuccessResponse(ok0), true);

    const badLow = loadMock('success_200.json');
    badLow.meta.studentMatch.score = -0.01;
    assert.equal(validateSuccessResponse(badLow), false);

    const badHigh = loadMock('success_200.json');
    badHigh.meta.studentMatch.score = 1.01;
    assert.equal(validateSuccessResponse(badHigh), false);
  });

  test('F6.B3: meta.elapsedMs >= 0 enforced by schema', () => {
    const ok0 = loadMock('success_200.json');
    ok0.meta.elapsedMs = 0;
    assert.equal(validateSuccessResponse(ok0), true);

    const neg = loadMock('success_200.json');
    neg.meta.elapsedMs = -1;
    assert.equal(validateSuccessResponse(neg), false);
  });

  test('F6.B4: concurrent identical /v1/recognize requests produce deterministic identical data', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png', mime: 'image/png' };
    const [r1, r2] = await Promise.all([
      postMultipart(`${engineBase}/v1/recognize`, {
        files: [{ field: 'main', ...main }],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      }),
      postMultipart(`${engineBase}/v1/recognize`, {
        files: [{ field: 'main', ...main }],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      }),
    ]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assertValidSuccess(r1.body);
    assertValidSuccess(r2.body);
    assert.deepEqual(r1.body.data, r2.body.data);
  });

  test('F6.B5: resolution preset boundary matches input resolution class (FHD vs QHD)', async () => {
    if (E2E_LIVE) {
      const res = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
        files: [{ field: 'main', ...loadFixture('student_info.png') }], // 2560x1440 QHD
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(res.status, 200);
      assertValidSuccess(res.body);
      assert.equal(res.body.meta.preset, 'QHD');
      return;
    }

    const fhd = await postMultipart(`${harness.engineUrl}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'fhd.png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(fhd.status, 200);
    assert.equal(fhd.body.meta.preset, 'FHD');

    const qhd = await postMultipart(`${harness.engineUrl}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(2560, 1440, { tags: { scene: 'student_info' } }), filename: 'qhd.png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(qhd.status, 200);
    assert.equal(qhd.body.meta.preset, 'QHD');
  });

  // F7: Backend Slot, File Count & Rate Limiter Boundaries
  test('F7.B1: unknown multipart slot field name fails with 400 INVALID_SLOT', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080), filename: 'main.png' };
    const extra = E2E_LIVE
      ? loadFixture('equipment_modal.png')
      : { buffer: makePngBuffer(1920, 1080), filename: 'extra.png' };
    const res = await postBackendLive(`${backendBase}/api/ocr`, {
      files: [
        { field: 'main', ...main },
        { field: 'extra_slot', ...extra },
      ],
    });
    assert.equal(res.status, 400);
    assertValidError(res.body, { requireSuccessFlag: true });
    assert.equal(res.body.code, 'INVALID_SLOT');
  });

  test('F7.B2: uploading >5 files fails with 400 INVALID_SLOT', async () => {
    const buf = makePngBuffer(1920, 1080);
    const res = await postMultipart(`${harness.backendUrl}/api/ocr`, {
      files: [
        { field: 'main', buffer: buf, filename: '1.png' },
        { field: 'equip1', buffer: buf, filename: '2.png' },
        { field: 'equip2', buffer: buf, filename: '3.png' },
        { field: 'equip3', buffer: buf, filename: '4.png' },
        { field: 'favorite', buffer: buf, filename: '5.png' },
        { field: 'equip1', buffer: buf, filename: '6.png' },
      ],
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_SLOT');
  });

  test('F7.B3: ocrLimiter allows 10 req/min and rejects 11th request with 429 RATE_LIMITED', async () => {
    const limited = await createContractHarness({ rateLimitMax: 10 });
    try {
      const buf = makePngBuffer(1280, 720);
      for (let i = 0; i < 10; i++) {
        const ok = await postMultipart(`${limited.backendUrl}/api/ocr`, {
          files: [{ field: 'main', buffer: buf, filename: 'm.png' }],
        });
        assert.equal(ok.status, 200, `Expected 200 on request ${i + 1}`);
      }
      const blocked = await postMultipart(`${limited.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: buf, filename: 'm.png' }],
      });
      assert.equal(blocked.status, 429);
      assertValidError(blocked.body, { requireSuccessFlag: true });
      assert.equal(blocked.body.code, 'RATE_LIMITED');
    } finally {
      await limited.close();
    }
  });

  test('F7.B4: authenticated Bearer JWT gets isolated rate-limit bucket from anonymous IP', async () => {
    const limited = await createContractHarness({ rateLimitMax: 2 });
    try {
      const buf = makePngBuffer(1280, 720);
      await postMultipart(`${limited.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] });
      await postMultipart(`${limited.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] });
      const anonBlocked = await postMultipart(`${limited.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] });
      assert.equal(anonBlocked.status, 429);

      const jwtAllowed = await postMultipart(`${limited.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: buf }],
        headers: { Authorization: 'Bearer user-42-jwt' },
      });
      assert.equal(jwtAllowed.status, 200);
    } finally {
      await limited.close();
    }
  });

  test('F7.B5: empty multipart request (0 files) fails with 400 MISSING_MAIN', async () => {
    const res = await postMultipart(`${harness.backendUrl}/api/ocr`, { files: [] });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'MISSING_MAIN');
  });

  // F8: Queue, Timeout, Abort & Unavailable Boundaries
  test('F8.B1: ocrQueue rejects requests beyond concurrency + maxQueue with 429 QUEUE_FULL', async () => {
    const queued = await createContractHarness({
      engineDelayMs: 250,
      concurrency: 1,
      maxQueue: 1,
      rateLimitMax: 50,
    });
    try {
      const buf = makePngBuffer(1280, 720);
      const p1 = postMultipart(`${queued.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] });
      const p2 = postMultipart(`${queued.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] });
      await new Promise((r) => setTimeout(r, 30));
      const p3 = await postMultipart(`${queued.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] });
      assert.equal(p3.status, 429);
      assertValidError(p3.body, { requireSuccessFlag: true });
      assert.equal(p3.body.code, 'QUEUE_FULL');
      await Promise.all([p1, p2]);
    } finally {
      await queued.close();
    }
  });

  test('F8.B2: engine delay exceeding OCR_ENGINE_TIMEOUT_MS returns 504 ENGINE_TIMEOUT', async () => {
    const slow = await createContractHarness({ engineDelayMs: 300, engineTimeoutMs: 60 });
    try {
      const res = await postMultipart(`${slow.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(1280, 720), filename: 'm.png' }],
      });
      assert.equal(res.status, 504);
      assertValidError(res.body, { requireSuccessFlag: true });
      assert.equal(res.body.code, 'ENGINE_TIMEOUT');
    } finally {
      await slow.close();
    }
  });

  test('F8.B3: waiting in queue longer than queueTimeoutMs returns 504 QUEUE_TIMEOUT', async () => {
    const qSlow = await createContractHarness({
      engineDelayMs: 250,
      concurrency: 1,
      maxQueue: 3,
      queueTimeoutMs: 50,
    });
    try {
      const buf = makePngBuffer(1280, 720);
      const p1 = postMultipart(`${qSlow.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] });
      const p2 = postMultipart(`${qSlow.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] });
      const [r1, r2] = await Promise.all([p1, p2]);
      assert.equal(r1.status, 200);
      assert.equal(r2.status, 504);
      assert.equal(r2.body.code, 'QUEUE_TIMEOUT');
    } finally {
      await qSlow.close();
    }
  });

  test('F8.B4: unreachable or malformed-JSON engine returns 503 ENGINE_UNAVAILABLE', async () => {
    const down = await createContractHarness({ engineDown: true });
    const badJson = await createContractHarness({ engineMalformedJson: true });
    try {
      const r1 = await postMultipart(`${down.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(1280, 720) }],
      });
      assert.equal(r1.status, 503);
      assertValidError(r1.body, { requireSuccessFlag: true });
      assert.equal(r1.body.code, 'ENGINE_UNAVAILABLE');

      const r2 = await postMultipart(`${badJson.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(1280, 720) }],
      });
      assert.equal(r2.status, 503);
      assert.equal(r2.body.code, 'ENGINE_UNAVAILABLE');
    } finally {
      await Promise.all([down.close(), badJson.close()]);
    }
  });

  test('F8.B5: AbortController cancellation mid-flight aborts upstream (499 contract) without crashing server', async () => {
    const slow = await createContractHarness({ engineDelayMs: 400, engineTimeoutMs: 2000 });
    try {
      const ctl = new AbortController();
      const pending = postMultipart(`${slow.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(1280, 720) }],
        signal: ctl.signal,
      });
      setTimeout(() => ctl.abort(), 40);
      await assert.rejects(pending, (err) => err.name === 'AbortError');

      const deadline = Date.now() + 500;
      while (slow.metrics.abortedUpstream < 1 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.ok(slow.metrics.abortedUpstream >= 1, `Expected abortedUpstream >= 1, got ${slow.metrics.abortedUpstream}`);

      assertValidError(
        { success: false, code: 'CLIENT_ABORTED', error: 'Client aborted request' },
        { requireSuccessFlag: true }
      );

      // Server stays healthy after client abort
      slow.opts.engineDelayMs = 0;
      const followUp = await postMultipart(`${slow.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(1280, 720) }],
      });
      assert.equal(followUp.status, 200);
    } finally {
      await slow.close();
    }
  });

  // F9: Client Pre-Validation & Parser Input Boundaries
  test('F9.B1: findStudentMasterByName strips role badges and fullwidth parentheses', () => {
    const master = [{ id: 101, name: '하나코(수영복)' }, { id: 102, name: '아루' }];
    assert.equal(parserMod.findStudentMasterByName('[STRIKER] 하나코（수영복）', master)?.id, 101);
    assert.equal(parserMod.findStudentMasterByName('아루 (STRIKER)', master)?.id, 102);
  });

  test('F9.B2: findStudentMasterByName returns undefined for empty name, empty master, or ambiguous short partial match', () => {
    const master = [{ id: 1, name: '시로코' }, { id: 2, name: '시로코(테러)' }];
    assert.equal(parserMod.findStudentMasterByName('', master), undefined);
    assert.equal(parserMod.findStudentMasterByName('아루', []), undefined);
    assert.equal(parserMod.findStudentMasterByName('시로', master), undefined);
  });

  test('F9.B3: findStudentMasterByName normalizes special symbols (*, middle-dot) cleanly', () => {
    const master = [{ id: 2, name: '시로코(테러)' }];
    assert.equal(parserMod.findStudentMasterByName('시로코*테러', master)?.id, 2);
    assert.equal(parserMod.findStudentMasterByName('시로코·테러', master)?.id, 2);
  });

  test('F9.B4: HTTP 21:9 +-2% tolerance edges (2470x1080 & 2570x1080 pass geometry; 2468x1080 & 2572x1080 fail 400)', async () => {
    for (const [w, h] of [[2470, 1080], [2570, 1080]]) {
      const passRes = await postMultipart(`${engineBase}/v1/recognize`, {
        files: [{ field: 'main', buffer: makePngBuffer(w, h), filename: `${w}x${h}.png` }],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      if (E2E_LIVE) {
        assert.notEqual(passRes.status, 400, `${w}x${h} should pass 21:9 +-2%`);
        assert.notEqual(passRes.body?.code, 'UNSUPPORTED_RATIO');
      } else {
        assert.equal(passRes.status, 200, `${w}x${h} should pass 21:9 +-2%`);
      }
    }

    for (const [w, h] of [[2468, 1080], [2572, 1080]]) {
      const failRes = await postMultipart(`${engineBase}/v1/recognize`, {
        files: [{ field: 'main', buffer: makePngBuffer(w, h), filename: `${w}x${h}.png` }],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(failRes.status, 400, `${w}x${h} should fail 21:9 +-2%`);
      assertValidError(failRes.body);
      assert.equal(failRes.body.code, 'UNSUPPORTED_RATIO');
    }
  });

  test('F9.B5: findStudentMasterByName transforms variant prefix and blocks wrong base fallback', () => {
    const master = [
      { id: 1, name: '하나코' },
      { id: 2, name: '하나코(수영복)' },
      { id: 3, name: '아루' },
    ];
    assert.equal(parserMod.findStudentMasterByName('수영복 하나코', master)?.id, 2);
    assert.equal(parserMod.findStudentMasterByName('드레스 아루', master), undefined);
  });

  // F10: Client Storage, Form Mapping & Build Boundaries
  test('F10.B1: mapOcrDataToFormValues maps unequipped equipments to null and missing level to 1', () => {
    const data = loadMock('needs_review_200.json').data;
    const mapped = parserMod.mapOcrDataToFormValues(data, [{ id: 1, name: '아루' }]);
    assert.deepEqual(mapped.equipment.slot1, { tier: 9, level: 65 });
    assert.deepEqual(mapped.equipment.slot2, { tier: 8, level: 1 });
    assert.equal(mapped.equipment.slot3, null);
  });

  test('F10.B2: mapOcrDataToFormValues sets uniqueWeapon:null when weapon.unequipped is true', () => {
    const data = loadMock('success_200.json').data;
    data.weapon = { unequipped: true, starGrade: null, level: null };
    const mapped = parserMod.mapOcrDataToFormValues(data, [{ id: 1, name: '하나코(수영복)' }]);
    assert.equal(mapped.uniqueWeapon, null);
  });

  test('F10.B3: mapOcrDataToFormValues maps all 4 stat & potentialLevel keys cleanly', () => {
    const mapped = parserMod.mapOcrDataToFormValues(loadMock('success_200.json').data, [{ id: 1, name: '하나코(수영복)' }]);
    assert.deepEqual(Object.keys(mapped.stats).sort(), ['attackPower', 'defensePower', 'healPower', 'maxHP']);
    assert.deepEqual(Object.keys(mapped.potentialLevels).sort(), ['attackPower', 'defensePower', 'healPower', 'maxHP']);
  });

  test('F10.B4: RegistrationModal.tsx wires favoriteItem (slot4) and needsReview highlights', (t) => {
    const data = loadMock('success_200.json').data;
    data.favoriteItem = { unequipped: false, tier: 1 };
    const mapped = parserMod.mapOcrDataToFormValues(data, [{ id: 10075, name: '하나코(수영복)' }]);
    assert.deepEqual(mapped.equipment.slot4, { tier: 1, level: 1 });

    if (!requireStrict(t)) return;
    const modalSrc = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'components', 'archive', 'RegistrationModal.tsx'), 'utf8');
    assert.match(modalSrc, /StudentOcrUploader/);
    assert.match(modalSrc, /onOcrExtracted/);
    assert.match(modalSrc, /slot4/);
    assert.match(modalSrc, /favoriteItem/);
    assert.match(modalSrc, /_needsReview/);
  });

  test('F10.B5: client TypeScript (tsc --noEmit) and ESLint pass with zero errors', (t) => {
    if (!requireStrict(t)) return;
    runClientScript('typescript/bin/tsc', ['--noEmit', '--incremental', 'false'], { timeout: 120000 });
    runClientScript('eslint/bin/eslint.js', ['.'], { timeout: 120000 });
  });

  // F11: Hygiene, Docs & Protected Paths Boundaries
  test('F11.B1: protected directories backend/data, backend/prisma, backend/uploads remain untouched', () => {
    const snap = snapshotProtectedPaths();
    assert.equal(snap['backend/data'].exists, true);
    assert.equal(snap['backend/prisma'].exists, true);
    assert.equal(snap['backend/uploads'].exists, true);
  });

  test('F11.B2: git ls-files tracks zero ONNX models or golden set binary images', (t) => {
    if (!requireStrict(t)) return;
    const tracked = runGit(['ls-files', 'ocr-engine/models', 'ocr-engine/tests/golden']);
    assert.doesNotMatch(tracked, /\.(onnx|png|jpg|jpeg|webp)$/i);
  });

  test('F11.B3: ocr-engine/.env.example and client/.env.example configure required env keys without NVIDIA_API_KEY', (t) => {
    if (!requireStrict(t)) return;
    const engineEnv = fs.readFileSync(path.join(REPO_ROOT, 'ocr-engine', '.env.example'), 'utf8');
    assert.match(engineEnv, /OCR_ENGINE_TOKEN=/);
    assert.match(engineEnv, /OCR_ENGINE_PORT=/);
    assert.doesNotMatch(engineEnv, /NVIDIA_API_KEY/);

    const clientEnv = fs.readFileSync(path.join(REPO_ROOT, 'client', '.env.example'), 'utf8');
    assert.match(clientEnv, /NEXT_PUBLIC_API_URL=/);
    assert.doesNotMatch(clientEnv, /NVIDIA_API_KEY/);
  });

  test('F11.B4: ocr-engine Python sources contain no hardcoded developer C:\\ paths', (t) => {
    if (!requireStrict(t)) return;
    const hits = scanFilesForPatterns(['ocr-engine'], [/[A-Za-z]:\\Users\\/i], { extensions: ['.py'] });
    assert.deepEqual(hits, []);
  });

  test('F11.B5: docs-vault/api-spec.md OCR section documents Express /api/ocr & /status without legacy Edge NIM spec', (t) => {
    if (!requireStrict(t)) return;
    const spec = fs.readFileSync(path.join(REPO_ROOT, 'docs-vault', 'api-spec.md'), 'utf8');
    const secMatch = /## 스크린샷 임포트 및 OCR[\s\S]*?(?=\n## |$)/.exec(spec);
    assert.ok(secMatch, 'Missing ## 스크린샷 임포트 및 OCR section in docs-vault/api-spec.md');
    const ocrSection = secMatch[0];
    assert.match(ocrSection, /\/api\/ocr\/status/);
    assert.match(ocrSection, /equip1|5슬롯/);
    assert.doesNotMatch(
      ocrSection,
      /POST `\/api\/ocr` \(Next\.js\)|ALLOWED_MODELS|deepseek-v4\.1-flash|mistralai\/|nvapi-|integrate\.api\.nvidia\.com|"image": "data:image\/jpeg;base64,/i
    );
  });
});
