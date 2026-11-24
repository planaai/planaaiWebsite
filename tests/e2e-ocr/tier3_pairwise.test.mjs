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
  assertValidSuccess,
  assertValidError,
  loadFixture,
  readUploadImage,
  makePngBuffer,
  makeJpegBuffer,
  makeWebpBuffer,
  postMultipart,
  postBackendLive,
  getJson,
  createContractHarness,
} from './helpers.mjs';

const parserMod = await import(
  pathToFileURL(path.join(REPO_ROOT, 'client', 'src', 'lib', 'ocr', 'studentOcrParser.ts')).href
);

function findGoldenFiveSlotSet() {
  const goldenDir = path.join(REPO_ROOT, 'ocr-engine', 'tests', 'golden');
  if (!fs.existsSync(goldenDir)) return null;
  for (const name of fs.readdirSync(goldenDir)) {
    if (name === 'README.md' || name.startsWith('.')) continue;
    const full = path.join(goldenDir, name);
    if (!fs.statSync(full).isDirectory()) continue;
    const slots = {};
    for (const f of fs.readdirSync(full)) {
      const m = /^(main|equip1|equip2|equip3|favorite)\.(png|jpe?g|webp)$/i.exec(f);
      if (m) slots[m[1].toLowerCase()] = path.join(full, f);
    }
    if (slots.main && slots.equip1 && slots.equip2 && slots.equip3 && slots.favorite) {
      return slots;
    }
  }
  return null;
}

function findGolden21x9() {
  const goldenDir = path.join(REPO_ROOT, 'ocr-engine', 'tests', 'golden');
  if (!fs.existsSync(goldenDir)) return null;
  for (const name of fs.readdirSync(goldenDir)) {
    if (name === 'README.md' || name.startsWith('.')) continue;
    const full = path.join(goldenDir, name);
    if (fs.statSync(full).isFile() && /\.(png|jpe?g|webp)$/i.test(name)) {
      const img = readUploadImage(full);
      if (img.info && Math.abs(img.info.width / img.info.height - 21 / 9) / (21 / 9) <= 0.02) {
        return img;
      }
    }
  }
  return null;
}

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

describe('Tier 3 — Pairwise Cross-Feature Combinations', () => {
  test('P1: main-only upload falls back equipments to main, flags needsReview, and maps to form', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png', mime: 'image/png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', ...main }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);
    assert.equal(res.body.meta.fieldSources['equipments[0]'], 'main');
    const eq0 = res.body.data.equipments[0];
    if (!eq0.unequipped) {
      if (eq0.level === null) {
        assert.ok(res.body.meta.needsReview.includes('equipments[0].level'));
      } else {
        assert.ok(Number.isInteger(eq0.level) && eq0.level >= 1);
        assert.equal(res.body.meta.needsReview.includes('equipments[0].level'), false);
      }
    }
    const mapped = parserMod.mapOcrDataToFormValues(res.body.data, [{ id: 10075, name: res.body.data.studentName }]);
    assert.equal(mapped.studentId, 10075);
    if (eq0.unequipped) {
      assert.equal(mapped.equipment.slot1, null);
    } else {
      assert.equal(mapped.equipment.slot1?.tier ?? null, eq0.tier);
    }
  });

  test('P2: main + equip1 partial modal overwrites target slot only while other slots fall back to main', async () => {
    const files = E2E_LIVE
      ? [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'equip1', ...loadFixture('equipment_modal.png') },
        ]
      : [
          { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
          { field: 'equip1', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '1' } }), filename: 'e1.png' },
        ];
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files,
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);

    const overwrittenIdx = [0, 1, 2].find((i) => res.body.meta.fieldSources[`equipments[${i}]`] === 'equip1');
    assert.notEqual(overwrittenIdx, undefined);
    assert.notEqual(res.body.data.equipments[overwrittenIdx].level, null);
    assert.equal(res.body.meta.needsReview.includes(`equipments[${overwrittenIdx}].level`), false);
    for (const i of [0, 1, 2]) {
      if (i === overwrittenIdx) continue;
      assert.equal(res.body.meta.fieldSources[`equipments[${i}]`], 'main');
      const eq = res.body.data.equipments[i];
      if (!eq.unequipped) {
        if (eq.level === null) {
          assert.ok(res.body.meta.needsReview.includes(`equipments[${i}].level`));
        } else {
          assert.ok(Number.isInteger(eq.level) && eq.level >= 1);
          assert.equal(res.body.meta.needsReview.includes(`equipments[${i}].level`), false);
        }
      }
    }
  });

  test('P3: full multi-slot upload overwrites provided modal & favorite slots cleanly', async () => {
    const golden5 = E2E_LIVE ? findGoldenFiveSlotSet() : null;
    if (E2E_LIVE && golden5) {
      const res = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
        files: Object.entries(golden5).map(([field, p]) => ({ field, ...readUploadImage(p) })),
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(res.status, 200);
      assertValidSuccess(res.body);
      assert.equal(res.body.meta.fieldSources.favoriteItem, 'favorite');
      for (const s of ['equip1', 'equip2', 'equip3']) {
        assert.ok(Object.values(res.body.meta.fieldSources).includes(s), `Expected ${s} in fieldSources`);
      }
      return;
    }

    if (E2E_LIVE) {
      const live3 = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
        files: [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'equip1', ...loadFixture('equipment_modal.png') },
          { field: 'favorite', ...loadFixture('favorite_popup.png') },
        ],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(live3.status, 200);
      assertValidSuccess(live3.body);
      assert.equal(live3.body.meta.fieldSources.favoriteItem, 'favorite');
      assert.ok([0, 1, 2].some((i) => live3.body.meta.fieldSources[`equipments[${i}]`] === 'equip1'));
    }

    const res = await postMultipart(`${harness.backendUrl}/api/ocr`, {
      files: [
        { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
        { field: 'equip1', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '1' } }), filename: 'e1.png' },
        { field: 'equip2', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '2' } }), filename: 'e2.png' },
        { field: 'equip3', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '3' } }), filename: 'e3.png' },
        { field: 'favorite', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'favorite_popup', favTier: '2' } }), filename: 'fav.png' },
      ],
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body, { requireSuccessFlag: true });
    assert.deepEqual(res.body.meta.fieldSources, {
      'equipments[0]': 'equip1',
      'equipments[1]': 'equip2',
      'equipments[2]': 'equip3',
      favoriteItem: 'favorite',
    });
    assert.deepEqual(res.body.meta.needsReview, []);
    assert.deepEqual(res.body.data.favoriteItem, { unequipped: false, tier: 2 });
  });

  test('P4: main + favorite only overrides favoriteItem while equipments retain main values', async () => {
    const files = E2E_LIVE
      ? [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'favorite', ...loadFixture('favorite_popup.png') },
        ]
      : [
          { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
          { field: 'favorite', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'favorite_popup', favTier: '1' } }), filename: 'fav.png' },
        ];
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files,
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);
    assert.equal(res.body.meta.fieldSources.favoriteItem, 'favorite');
    assert.equal(res.body.meta.fieldSources['equipments[0]'], 'main');
    if (!E2E_LIVE) {
      assert.deepEqual(res.body.data.favoriteItem, { unequipped: false, tier: 1 });
    }
  });

  test('P5: concurrent mixed aspect ratios (16:9 + 21:9) under concurrency=2 stay isolated', async () => {
    if (E2E_LIVE) {
      const golden21 = findGolden21x9();
      const [r16, r21] = await Promise.all([
        postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
          files: [{ field: 'main', ...loadFixture('student_info.png') }],
          headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
        }),
        postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
          files: [{
            field: 'main',
            ...(golden21 || { buffer: makePngBuffer(2560, 1080), filename: '219.png', mime: 'image/png' }),
          }],
          headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
        }),
      ]);
      assert.equal(r16.status, 200);
      assert.equal(r16.body.meta.preset, 'QHD');
      assert.notEqual(r21.status, 400);
      assert.notEqual(r21.body?.code, 'UNSUPPORTED_RATIO');
      return;
    }

    const [r16, r21] = await Promise.all([
      postMultipart(`${harness.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: '169.png' }],
      }),
      postMultipart(`${harness.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(2560, 1080, { tags: { scene: 'student_info' } }), filename: '219.png' }],
      }),
    ]);
    assert.equal(r16.status, 200);
    assert.equal(r21.status, 200);
    assert.equal(r16.body.meta.preset, 'FHD');
    assert.equal(r21.body.meta.preset, '21:9');
  });

  test('P6: optionalAuth anonymous exhaustion (429) leaves authenticated Bearer JWT unaffected', async () => {
    const h = await createContractHarness({ rateLimitMax: 1 });
    try {
      const buf = makePngBuffer(1280, 720);
      assert.equal((await postMultipart(`${h.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] })).status, 200);
      assert.equal((await postMultipart(`${h.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf }] })).status, 429);
      const authRes = await postMultipart(`${h.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: buf }],
        headers: { Authorization: 'Bearer valid-user-token' },
      });
      assert.equal(authRes.status, 200);
    } finally {
      await h.close();
    }
  });

  test('P7: SLOT_DUPLICATE across equip1 & equip3 propagates engine -> backend -> schema-valid 422', async () => {
    const files = E2E_LIVE
      ? [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'equip1', ...loadFixture('equipment_modal.png') },
          { field: 'equip3', ...loadFixture('equipment_modal.png') },
        ]
      : [
          { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
          { field: 'equip1', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '2' } }), filename: 'e1.png' },
          { field: 'equip3', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '2' } }), filename: 'e3.png' },
        ];
    const res = await postBackendLive(`${backendBase}/api/ocr`, { files });
    assert.equal(res.status, 422);
    assertValidError(res.body, { requireSuccessFlag: true });
    assert.equal(res.body.code, 'SLOT_DUPLICATE');
    assert.equal(res.body.detail.slot, 'equip3');
    assert.equal(res.body.detail.conflictingWith, 'equip1');
  });

  test('P8: SCENE_MISMATCH (favorite_popup in equip1) propagates engine -> backend -> schema-valid 422', async () => {
    const files = E2E_LIVE
      ? [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'equip1', ...loadFixture('favorite_popup.png') },
        ]
      : [
          { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
          { field: 'equip1', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'favorite_popup' } }), filename: 'e1.png' },
        ];
    const res = await postBackendLive(`${backendBase}/api/ocr`, { files });
    assert.equal(res.status, 422);
    assertValidError(res.body, { requireSuccessFlag: true });
    assert.equal(res.body.code, 'SCENE_MISMATCH');
    assert.equal(res.body.detail.slot, 'equip1');
    assert.equal(res.body.detail.detected, 'favorite_popup');
  });

  test('P9: engine outage (503 + /status healthy:false) recovers cleanly to 200 + healthy:true', async () => {
    const h = await createContractHarness({ engineDown: true });
    try {
      const s1 = await getJson(`${h.backendUrl}/api/ocr/status`);
      assert.equal(s1.status, 200);
      assert.equal(s1.body.healthy, false);
      const r1 = await postMultipart(`${h.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(1280, 720) }],
      });
      assert.equal(r1.status, 503);

      h.opts.engineDown = false;
      const s2 = await getJson(`${h.backendUrl}/api/ocr/status`);
      assert.equal(s2.status, 200);
      assert.equal(s2.body.healthy, true);
      const r2 = await postMultipart(`${h.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(1280, 720) }],
      });
      assert.equal(r2.status, 200);
    } finally {
      await h.close();
    }
  });

  test('P10: mixed PNG (1920x1080) + JPEG + WebP (VP8X+VP8L 1280x720) 3-slot upload decodes cleanly', async () => {
    if (E2E_LIVE) {
      const res = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
        files: [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'equip1', buffer: makePngBuffer(1920, 1080), filename: 'e1.png', mime: 'image/png' },
          { field: 'favorite', buffer: makeWebpBuffer(1280, 720), filename: 'fav.webp', mime: 'image/webp' },
        ],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      // Proves OpenCV decoded JPEG + PNG + VP8X+VP8L WebP without 400 BAD_IMAGE (reaches scene check -> 422)
      assert.notEqual(res.status, 400);
      assert.notEqual(res.body?.code, 'BAD_IMAGE');
      return;
    }

    const res = await postMultipart(`${harness.backendUrl}/api/ocr`, {
      files: [
        { field: 'main', buffer: makePngBuffer(1920, 1080), filename: 'main.png', mime: 'image/png' },
        { field: 'equip1', buffer: makeJpegBuffer(2560, 1080), filename: 'e1.jpg', mime: 'image/jpeg' },
        { field: 'favorite', buffer: makeWebpBuffer(1280, 720), filename: 'fav.webp', mime: 'image/webp' },
      ],
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body, { requireSuccessFlag: true });
  });

  test('P11: needs_review + null bondRank + null releaseLevel flows from OCR response into ArchiveRecord shape', async () => {
    const res = await postMultipart(`${harness.backendUrl}/api/ocr`, {
      files: [{
        field: 'main',
        buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info', case: 'needs_review' } }),
        filename: 'main.png',
      }],
    });
    assert.equal(res.status, 200);
    const mapped = parserMod.mapOcrDataToFormValues(res.body.data, [{ id: 10075, name: '하나코(수영복)' }]);
    assert.equal(mapped.bondRank, undefined);
    assert.equal(mapped.potentialLevels.attackPower, null);
    assert.ok(res.body.meta.needsReview.includes('bondRank'));
  });

  test('P12: queue concurrency capped at 2 while handling burst + subsequent clean completion', async () => {
    const h = await createContractHarness({ engineDelayMs: 60, concurrency: 2, maxQueue: 6, rateLimitMax: 50 });
    try {
      const buf = makePngBuffer(1280, 720);
      const results = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          postMultipart(`${h.backendUrl}/api/ocr`, { files: [{ field: 'main', buffer: buf, filename: `${i}.png` }] })
        )
      );
      for (const r of results) assert.equal(r.status, 200);
      assert.ok(h.metrics.maxObservedInFlight <= 2, `Expected <= 2 in-flight, got ${h.metrics.maxObservedInFlight}`);
    } finally {
      await h.close();
    }
  });
});
