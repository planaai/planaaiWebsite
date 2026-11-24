import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO_ROOT,
  E2E_LIVE,
  E2E_STRICT,
  OCR_ENGINE_URL,
  BACKEND_URL,
  CLIENT_URL,
  OCR_ENGINE_TOKEN,
  PRESERVED_STORAGE_KEYS,
  PROTECTED_PATHS,
  requireLive,
  requireStrict,
  validateRecognizeSchema,
  validateSuccessResponse,
  validateErrorResponse,
  loadMock,
  loadFixture,
  readUploadImage,
  assertValidSuccess,
  assertValidError,
  makePngBuffer,
  makeJpegBuffer,
  makeWebpBuffer,
  inspectImageBuffer,
  postMultipart,
  postBackendLive,
  getJson,
  getOcrEnginePython,
  runClientScript,
  createContractHarness,
  snapshotDirTree,
  snapshotProtectedPaths,
  scanFilesForPatterns,
  runGit,
} from './helpers.mjs';

const parserMod = await import(
  pathToFileURL(path.join(REPO_ROOT, 'client', 'src', 'lib', 'ocr', 'studentOcrParser.ts')).href
);

function findFirstGolden21x9() {
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

function findGoldenSubfolders() {
  const goldenDir = path.join(REPO_ROOT, 'ocr-engine', 'tests', 'golden');
  if (!fs.existsSync(goldenDir)) return { topFiles: [], sets: [] };
  const topFiles = [];
  const sets = [];
  for (const name of fs.readdirSync(goldenDir)) {
    if (name === 'README.md' || name.startsWith('.')) continue;
    const full = path.join(goldenDir, name);
    const stat = fs.statSync(full);
    if (stat.isFile() && /\.(png|jpe?g|webp)$/i.test(name)) {
      topFiles.push(full);
    } else if (stat.isDirectory()) {
      const slotFiles = {};
      for (const f of fs.readdirSync(full)) {
        const m = /^(main|equip1|equip2|equip3|favorite)\.(png|jpe?g|webp)$/i.exec(f);
        if (m) slotFiles[m[1].toLowerCase()] = path.join(full, f);
      }
      if (slotFiles.main) {
        const expPath = path.join(full, 'expected.json');
        sets.push({
          name,
          slotFiles,
          expected: fs.existsSync(expPath) ? JSON.parse(fs.readFileSync(expPath, 'utf8')) : null,
        });
      }
    }
  }
  return { topFiles, sets };
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

describe('Tier 1 — Feature Coverage (F1..F11)', () => {
  // F1: Contract schema & mocks
  test('F1.1: success_200 mock validates against recognize.schema.json', () => {
    const mock = loadMock('success_200.json');
    assertValidSuccess(mock);
  });

  test('F1.2: needs_review_200 mock validates against recognize.schema.json', () => {
    const mock = loadMock('needs_review_200.json');
    assertValidSuccess(mock);
    assert.equal(mock.data.bondRank, null);
    assert.ok(mock.meta.needsReview.includes('bondRank'));
  });

  test('F1.3: scene_mismatch_422 mock validates against recognize.schema.json', () => {
    const mock = loadMock('scene_mismatch_422.json');
    assertValidError(mock);
    assert.equal(mock.code, 'SCENE_MISMATCH');
    assert.equal(mock.detail.slot, 'equip2');
    assert.equal(mock.detail.detected, 'student_info');
  });

  test('F1.4: backend-wrapped success:true and error:false payloads validate schema', () => {
    const okPayload = { success: true, ...loadMock('success_200.json') };
    assertValidSuccess(okPayload, { requireSuccessFlag: true });
    const errPayload = {
      success: false,
      code: 'SCENE_MISMATCH',
      error: 'Slot mismatch',
      detail: { slot: 'equip2', detected: 'student_info', expected: 'equipment_modal' },
    };
    assertValidError(errPayload, { requireSuccessFlag: true });
  });

  test('F1.5: negative schema mutations fail Ajv validation', () => {
    const noBond = loadMock('success_200.json');
    delete noBond.data.bondRank;
    assert.equal(validateSuccessResponse(noBond), false);

    const zeroRelease = loadMock('success_200.json');
    zeroRelease.data.stats.hp.releaseLevel = 0;
    assert.equal(validateSuccessResponse(zeroRelease), false);

    const noDetailMismatch = { code: 'SCENE_MISMATCH', message: 'missing detail' };
    assert.equal(validateErrorResponse(noDetailMismatch), false);

    const noDetailDup = { code: 'SLOT_DUPLICATE', message: 'missing detail' };
    assert.equal(validateErrorResponse(noDetailDup), false);

    const extraRoot = { ...loadMock('success_200.json'), extraField: 1 };
    assert.equal(validateRecognizeSchema(extraRoot), false);
  });

  // F2: screenshotMacro@54b3994 core extraction contract
  test('F2.1: engine /v1/recognize returns all 9 NormalizedStudentOcrData keys for student_info', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png', mime: 'image/png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', ...main }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);
    for (const k of ['studentName', 'level', 'starGrade', 'bondRank', 'skills', 'equipments', 'favoriteItem', 'weapon', 'stats']) {
      assert.ok(Object.hasOwn(res.body.data, k), `missing ${k}`);
    }
  });

  test('F2.2: skills upper bounds (ex=5, normal/passive/sub=10) validate and map to form values', () => {
    const mock = loadMock('success_200.json');
    assertValidSuccess(mock);
    const mapped = parserMod.mapOcrDataToFormValues(mock.data, [{ id: 10075, name: '하나코(수영복)' }]);
    assert.deepEqual(mapped.skillLevels, { ex: 5, normal: 10, passive: 10, sub: 10 });
  });

  test('F2.3: unequipped weapon and favoriteItem carry null subfields per contract', async () => {
    const mainWeapon = makePngBuffer(1920, 1080, {
      tags: { scene: 'student_info', case: 'unequipped_weapon' },
    });
    const rWeapon = await postMultipart(`${harness.engineUrl}/v1/recognize`, {
      files: [{ field: 'main', buffer: mainWeapon, filename: 'main.png', mime: 'image/png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(rWeapon.status, 200);
    assertValidSuccess(rWeapon.body);
    assert.deepEqual(rWeapon.body.data.weapon, { unequipped: true, starGrade: null, level: null });

    const mainFav = makePngBuffer(1920, 1080, {
      tags: { scene: 'student_info', case: 'no_favorite' },
    });
    const rFav = await postMultipart(`${harness.engineUrl}/v1/recognize`, {
      files: [{ field: 'main', buffer: mainFav, filename: 'main.png', mime: 'image/png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(rFav.status, 200);
    assertValidSuccess(rFav.body);
    assert.deepEqual(rFav.body.data.favoriteItem, { unequipped: true, tier: null });
  });

  test('F2.4: 21:9 aspect ratio (2560x1080) passes geometry gate and normalizes preset', async () => {
    const golden21 = E2E_LIVE ? findFirstGolden21x9() : null;
    if (E2E_LIVE && golden21) {
      const res = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
        files: [{ field: 'main', ...golden21 }],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(res.status, 200);
      assertValidSuccess(res.body);
      assert.ok(res.body.meta.preset.length > 0);
      return;
    }

    const buf = makePngBuffer(2560, 1080, { tags: { scene: 'student_info' } });
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: buf, filename: 'ultrawide.png', mime: 'image/png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    if (E2E_LIVE) {
      // Blank synthetic pixels pass 400 UNSUPPORTED_RATIO/LOW_RESOLUTION and reach scene detection
      assert.notEqual(res.status, 400);
      assert.notEqual(res.body?.code, 'UNSUPPORTED_RATIO');
      assert.notEqual(res.body?.code, 'LOW_RESOLUTION');
    } else {
      assert.equal(res.status, 200);
      assertValidSuccess(res.body);
      assert.equal(res.body.meta.preset, '21:9');
    }
  });

  test('F2.5: ocr-engine ported vendor modules, ONNX model/dict, and students.json exist without GUI/NIM', (t) => {
    if (!requireStrict(t)) return;
    const expectedFiles = [
      'ocr-engine/vendor/extractor.py',
      'ocr-engine/vendor/equipment_reader.py',
      'ocr-engine/vendor/coordinates.py',
      'ocr-engine/models/korean_PP-OCRv3_rec_infer.onnx',
      'ocr-engine/models/korean_dict.txt',
      'ocr-engine/students.json',
    ];
    for (const rel of expectedFiles) {
      assert.equal(fs.existsSync(path.join(REPO_ROOT, rel)), true, `Missing ${rel}`);
    }
    for (const forbidden of ['ocr-engine/vendor/gui_app.py', 'ocr-engine/vendor/nim_client.py', 'ocr-engine/vendor/macro.py']) {
      assert.equal(fs.existsSync(path.join(REPO_ROOT, forbidden)), false, `Forbidden module present: ${forbidden}`);
    }
  });

  // F3: FastAPI Engine Endpoints & Auth
  test('F3.1: GET /healthz returns ok, version, modelsLoaded, studentNamesCount', async () => {
    const res = await getJson(`${engineBase}/healthz`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.version, 'string');
    assert.equal(res.body.modelsLoaded, true);
    assert.ok(Number.isInteger(res.body.studentNamesCount) && res.body.studentNamesCount > 0);
  });

  test('F3.2: POST /v1/recognize accepts lowercase x-engine-token and returns application/json metadata', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png', mime: 'image/png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', ...main }],
      headers: { 'x-engine-token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/i);
    assertValidSuccess(res.body);
    assert.match(res.body.meta.engine, /^plana-ocr/);
  });

  test('F3.3: POST /v1/students/reload with valid X-Engine-Token reloads student list', async () => {
    const res = await fetch(`${engineBase}/v1/students/reload`, {
      method: 'POST',
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.count > 0);
    assert.ok(['backend', 'bundled'].includes(body.source));
  });

  test('F3.4: POST /v1/students/reload falls back to bundled students.json when backend unavailable', async () => {
    const isolated = await createContractHarness({ reloadBackendReachable: false });
    try {
      const res = await fetch(`${isolated.engineUrl}/v1/students/reload`, {
        method: 'POST',
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.equal(body.source, 'bundled');
    } finally {
      await isolated.close();
    }
  });

  test('F3.5: live ocr-engine on 127.0.0.1:8090 answers /healthz, /v1/recognize, and /v1/students/reload', async (t) => {
    if (!requireLive(t)) return;
    const h = await getJson(`${OCR_ENGINE_URL}/healthz`);
    assert.equal(h.status, 200);
    assert.equal(h.body.ok, true);
    assert.equal(h.body.modelsLoaded, true);

    const rec = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
      files: [{ field: 'main', ...loadFixture('student_info.png') }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(rec.status, 200);
    assertValidSuccess(rec.body);
    assert.equal(rec.body.meta.scenes.main, 'student_info');

    const reload = await fetch(`${OCR_ENGINE_URL}/v1/students/reload`, {
      method: 'POST',
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(reload.status, 200);
    const reloadBody = await reload.json();
    assert.equal(reloadBody.ok, true);
    assert.equal(typeof reloadBody.count, 'number');
    assert.ok(reloadBody.count > 0);
  });

  // F4: In-Memory Decode & Win11 Ops
  test('F4.1: in-memory image builders produce valid PNG, JPEG, and WebP buffers decodable by OpenCV', () => {
    const pngBuf = makePngBuffer(1920, 1080);
    const jpgBuf = makeJpegBuffer(1920, 1080);
    const webpBuf = makeWebpBuffer(1920, 1080);

    const png = inspectImageBuffer(pngBuf);
    const jpg = inspectImageBuffer(jpgBuf);
    const webp = inspectImageBuffer(webpBuf);
    assert.deepEqual([png.format, png.width, png.height], ['png', 1920, 1080]);
    assert.deepEqual([jpg.format, jpg.width, jpg.height], ['jpeg', 1920, 1080]);
    assert.deepEqual([webp.format, webp.width, webp.height], ['webp', 1920, 1080]);
    assert.equal(inspectImageBuffer(webpBuf.subarray(0, 30)), null, 'Header-only WebP stub must be rejected');

    const py = getOcrEnginePython();
    if (fs.existsSync(py)) {
      const pyScript = [
        'import sys, cv2, numpy as np',
        'for line in sys.stdin:',
        '    h = line.strip()',
        '    if not h: continue',
        '    img = cv2.imdecode(np.frombuffer(bytes.fromhex(h), np.uint8), cv2.IMREAD_COLOR)',
        '    assert img is not None and img.shape == (1080, 1920, 3), f"bad shape {None if img is None else img.shape}"',
        'print("OPENCV_OK")',
      ].join('\n');
      const out = execFileSync(py, ['-c', pyScript], {
        input: `${pngBuf.toString('hex')}\n${jpgBuf.toString('hex')}\n${webpBuf.toString('hex')}\n`,
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.match(out, /OPENCV_OK/);
    }
  });

  test('F4.2: Korean/Unicode filename uploads cleanly in memory', async () => {
    const main = E2E_LIVE
      ? { ...loadFixture('student_info.png'), filename: '테스트_하나코(수영복).jpg' }
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: '테스트_하나코(수영복).png', mime: 'image/png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', ...main }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);
  });

  test('F4.3: engine recognition writes zero temp or audit files inside ocr-engine/ by default', async () => {
    const beforeTree = snapshotDirTree('ocr-engine');
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png', mime: 'image/png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', ...main }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    const afterTree = snapshotDirTree('ocr-engine');
    assert.deepEqual(afterTree, beforeTree);
  });

  test('F4.4: Windows 11 startup scripts and engine config files exist', (t) => {
    if (!requireStrict(t)) return;
    for (const rel of [
      'ocr-engine/start_ocr_engine.bat',
      'ocr-engine/start_ocr_engine.ps1',
      'ocr-engine/requirements.txt',
      'ocr-engine/README.md',
      'ocr-engine/.env.example',
    ]) {
      assert.equal(fs.existsSync(path.join(REPO_ROOT, rel)), true, `Missing ${rel}`);
    }
    const ps1 = fs.readFileSync(path.join(REPO_ROOT, 'ocr-engine', 'start_ocr_engine.ps1'), 'utf8');
    assert.match(ps1, /127\.0\.0\.1/);
  });

  test('F4.5: .gitignore excludes ONNX models and golden set images', () => {
    const ignoredOnnx = runGit(['check-ignore', 'ocr-engine/models/korean_PP-OCRv3_rec_infer.onnx']);
    const ignoredGolden = runGit(['check-ignore', 'ocr-engine/tests/golden/sample.png']);
    assert.match(ignoredOnnx, /\.onnx/);
    assert.match(ignoredGolden, /golden/);
  });

  // F5: Single adapter.py & Scene/Slot Guard
  test('F5.1: bondRank key is always present even when OCR fails (null + needsReview)', async () => {
    const main = makePngBuffer(1920, 1080, { tags: { scene: 'student_info', case: 'needs_review' } });
    const res = await postMultipart(`${harness.engineUrl}/v1/recognize`, {
      files: [{ field: 'main', buffer: main, filename: 'main.png', mime: 'image/png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);
    assert.equal(Object.hasOwn(res.body.data, 'bondRank'), true);
    assert.equal(res.body.data.bondRank, null);
    assert.ok(res.body.meta.needsReview.includes('bondRank'));
  });

  test('F5.2: stats.*.releaseLevel is null when absent and never 0', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png', mime: 'image/png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', ...main }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);
    for (const stat of Object.values(res.body.data.stats)) {
      assert.notEqual(stat.releaseLevel, 0);
      assert.ok(stat.releaseLevel === null || (stat.releaseLevel >= 1 && stat.releaseLevel <= 25));
    }
  });

  test('F5.3: equipment_modal (equip1..3) overwrites main equipments and updates fieldSources', async () => {
    if (E2E_LIVE) {
      const res = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
        files: [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'equip1', ...loadFixture('equipment_modal.png') },
        ],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(res.status, 200);
      assertValidSuccess(res.body);
      const overwrittenIdx = [0, 1, 2].find((i) => res.body.meta.fieldSources[`equipments[${i}]`] === 'equip1');
      assert.notEqual(overwrittenIdx, undefined, 'Expected equip1 to overwrite one equipment slot');
      assert.equal(res.body.meta.needsReview.includes(`equipments[${overwrittenIdx}].level`), false);
      return;
    }

    const files = [
      { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
      { field: 'equip1', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '1' } }), filename: 'e1.png' },
      { field: 'equip2', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '2' } }), filename: 'e2.png' },
    ];
    const res = await postMultipart(`${harness.engineUrl}/v1/recognize`, {
      files,
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);
    assert.equal(res.body.meta.fieldSources['equipments[0]'], 'equip1');
    assert.equal(res.body.meta.fieldSources['equipments[1]'], 'equip2');
    assert.equal(res.body.meta.fieldSources['equipments[2]'], 'main');
    assert.equal(res.body.data.equipments[0].level, 65);
  });

  test('F5.4: favorite_popup (favorite) overwrites main favoriteItem and sets fieldSources', async () => {
    const files = E2E_LIVE
      ? [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'favorite', ...loadFixture('favorite_popup.png') },
        ]
      : [
          { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
          { field: 'favorite', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'favorite_popup', favTier: '2' } }), filename: 'fav.png' },
        ];
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files,
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);
    assert.equal(res.body.meta.fieldSources.favoriteItem, 'favorite');
    if (!E2E_LIVE) {
      assert.deepEqual(res.body.data.favoriteItem, { unequipped: false, tier: 2 });
    }
  });

  test('F5.5: meta.scenes accurately reflects uploaded slots and detected scenes', async () => {
    const files = E2E_LIVE
      ? [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'equip3', ...loadFixture('equipment_modal.png') },
        ]
      : [
          { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
          { field: 'equip3', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '3' } }), filename: 'e3.png' },
        ];
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files,
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.meta.scenes, { main: 'student_info', equip3: 'equipment_modal' });
  });

  // F6: Engine Parity, Fixtures & Golden Set
  test('F6.1: golden/README.md exists and documents single-image and 5-slot conventions', () => {
    const readme = fs.readFileSync(path.join(REPO_ROOT, 'ocr-engine', 'tests', 'golden', 'README.md'), 'utf8');
    assert.match(readme, /main\.png/);
    assert.match(readme, /equip1\.png/);
    assert.match(readme, /favorite\.png/);
    assert.match(readme, /expected\.json/);
  });

  test('F6.2: ocr-engine/tests/fixtures/ all 3 baseline scenes recognize cleanly', async (t) => {
    if (!requireLive(t)) return;
    const res = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
      files: [
        { field: 'main', ...loadFixture('student_info.png') },
        { field: 'equip1', ...loadFixture('equipment_modal.png') },
        { field: 'favorite', ...loadFixture('favorite_popup.png') },
      ],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body);
    assert.deepEqual(res.body.meta.scenes, {
      main: 'student_info',
      equip1: 'equipment_modal',
      favorite: 'favorite_popup',
    });
    assert.equal(res.body.meta.fieldSources.favoriteItem, 'favorite');
    assert.ok([0, 1, 2].some((i) => res.body.meta.fieldSources[`equipments[${i}]`] === 'equip1'));
  });

  test('F6.3: ocr-engine parity tests pass against upstream screenshotMacro', (t) => {
    if (!requireStrict(t)) return;
    const py = getOcrEnginePython();
    assert.equal(fs.existsSync(py), true, 'Missing ocr-engine/.venv Python executable');
    const out = execFileSync(py, ['-m', 'pytest', 'tests/test_parity.py', '-v', '--tb=short'], {
      cwd: path.join(REPO_ROOT, 'ocr-engine'),
      encoding: 'utf8',
      timeout: 120000,
    });
    assert.match(out, /test_parity_main_and_3_scene_fixtures\s+PASSED/);
    assert.match(out, /test_21_9_preprocess_isolation\s+PASSED/);
  });

  test('F6.4: golden set evaluation runs against /v1/recognize and expected.json when populated', async (t) => {
    if (!requireLive(t)) return;
    const { topFiles, sets } = findGoldenSubfolders();
    if (topFiles.length === 0 && sets.length === 0) {
      t.skip('ocr-engine/tests/golden/ contains only README.md');
      return;
    }

    for (const set of sets) {
      const files = Object.entries(set.slotFiles).map(([field, abs]) => ({
        field,
        ...readUploadImage(abs),
      }));
      const res = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
        files,
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(res.status, 200, `Golden set ${set.name} failed with ${res.status}`);
      assertValidSuccess(res.body);
      if (set.expected) {
        const exp = set.expected.data || set.expected;
        const review = new Set(res.body.meta.needsReview || []);
        if (exp.studentName && !review.has('studentName')) assert.equal(res.body.data.studentName, exp.studentName);
        if (exp.level !== undefined && !review.has('level')) assert.equal(res.body.data.level, exp.level);
        if (exp.starGrade !== undefined && !review.has('starGrade')) assert.equal(res.body.data.starGrade, exp.starGrade);
        if (exp.bondRank !== undefined && !review.has('bondRank')) assert.equal(res.body.data.bondRank, exp.bondRank);
      }
    }

    if (topFiles.length > 0) {
      const py = getOcrEnginePython();
      const out = execFileSync(py, ['-m', 'pytest', 'tests/test_parity.py', '-k', 'test_golden_images_if_present', '-v', '--tb=short'], {
        cwd: path.join(REPO_ROOT, 'ocr-engine'),
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.match(out, /test_golden_images_if_present\s+PASSED/);
    }
  });

  test('F6.5: meta.needsReview preserves unique field paths for unprovided modal slots', async () => {
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png', mime: 'image/png' };
    const res = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', ...main }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(res.status, 200);
    assert.equal(new Set(res.body.meta.needsReview).size, res.body.meta.needsReview.length);
    for (let i = 0; i < 3; i++) {
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

  // F7: Backend Multipart Upload & Security
  test('F7.1: POST /api/ocr supports anonymous upload (optionalAuth) with all 5 slots', async () => {
    const files = [
      { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
      { field: 'equip1', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '1' } }), filename: 'e1.png' },
      { field: 'equip2', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '2' } }), filename: 'e2.png' },
      { field: 'equip3', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'equipment_modal', activeSlot: '3' } }), filename: 'e3.png' },
      { field: 'favorite', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'favorite_popup' } }), filename: 'fav.png' },
    ];
    const res = await postMultipart(`${harness.backendUrl}/api/ocr`, { files });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body, { requireSuccessFlag: true });
    assert.deepEqual(res.body.meta.needsReview, []);
  });

  test('F7.2: POST /api/ocr accepts Authorization Bearer JWT header', async () => {
    if (E2E_LIVE && process.env.E2E_JWT) {
      const res = await postBackendLive(`${BACKEND_URL}/api/ocr`, {
        files: [{ field: 'main', ...loadFixture('student_info.png') }],
        headers: { Authorization: `Bearer ${process.env.E2E_JWT}` },
      });
      assert.equal(res.status, 200);
      assertValidSuccess(res.body, { requireSuccessFlag: true });
      return;
    }

    const main = makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } });
    const res = await postMultipart(`${harness.backendUrl}/api/ocr`, {
      files: [{ field: 'main', buffer: main, filename: 'main.png' }],
      headers: { Authorization: 'Bearer dummy.jwt.token' },
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body, { requireSuccessFlag: true });
  });

  test('F7.3: POST /api/ocr accepts HD (1280x720), FHD (1920x1080), and 21:9 (2560x1080) PNGs', async () => {
    for (const [w, h] of [[1280, 720], [1920, 1080], [2560, 1080]]) {
      const res = await postMultipart(`${harness.backendUrl}/api/ocr`, {
        files: [{ field: 'main', buffer: makePngBuffer(w, h, { tags: { scene: 'student_info' } }), filename: `${w}x${h}.png` }],
      });
      assert.equal(res.status, 200, `Failed for ${w}x${h}`);
      assertValidSuccess(res.body, { requireSuccessFlag: true });
    }
  });

  test('F7.4: POST /api/ocr performs zero writes inside backend/uploads/', async () => {
    const beforeSnap = snapshotProtectedPaths();
    const main = E2E_LIVE
      ? loadFixture('student_info.png')
      : { buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png', mime: 'image/png' };
    const res = await postBackendLive(`${backendBase}/api/ocr`, {
      files: [{ field: 'main', ...main }],
    });
    assert.equal(res.status, 200);
    const afterSnap = snapshotProtectedPaths();
    assert.deepEqual(afterSnap['backend/uploads'], beforeSnap['backend/uploads']);
  });

  test('F7.5: live backend POST /api/ocr merges fixtures and returns schema-valid payload', async (t) => {
    if (!requireLive(t)) return;
    const res = await postBackendLive(`${BACKEND_URL}/api/ocr`, {
      files: [
        { field: 'main', ...loadFixture('student_info.png') },
        { field: 'favorite', ...loadFixture('favorite_popup.png') },
      ],
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body, { requireSuccessFlag: true });
    assert.equal(res.body.meta.fieldSources.favoriteItem, 'favorite');
  });

  // F8: Backend Proxy Client, Queue & /status
  test('F8.1: GET /api/ocr/status returns healthy:true and queue metrics when engine is up', async () => {
    const res = await getJson(`${backendBase}/api/ocr/status`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.engine, 'plana-ocr');
    assert.equal(res.body.healthy, true);
    assert.equal(typeof res.body.metrics, 'object');
  });

  test('F8.2: GET /api/ocr/status never throws when engine is down (returns 200 healthy:false)', async () => {
    const downHarness = await createContractHarness({ engineDown: true });
    try {
      const res = await getJson(`${downHarness.backendUrl}/api/ocr/status`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.healthy, false);
    } finally {
      await downHarness.close();
    }
  });

  test('F8.3: backend proxy forwards engine data + meta wrapped with success:true', async () => {
    const res = await postMultipart(`${harness.backendUrl}/api/ocr`, {
      files: [{ field: 'main', buffer: makePngBuffer(1920, 1080), filename: 'main.png' }],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assertValidSuccess(res.body, { requireSuccessFlag: true });
  });

  test('F8.4: backend proxy normalizes engine 422 SCENE_MISMATCH to { success:false, error, code, detail }', async () => {
    const files = E2E_LIVE
      ? [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'equip2', ...loadFixture('student_info.png') },
        ]
      : [
          { field: 'main', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'main.png' },
          { field: 'equip2', buffer: makePngBuffer(1920, 1080, { tags: { scene: 'student_info' } }), filename: 'wrong.png' },
        ];
    const res = await postBackendLive(`${backendBase}/api/ocr`, { files });
    assert.equal(res.status, 422);
    assertValidError(res.body, { requireSuccessFlag: true });
    assert.equal(res.body.code, 'SCENE_MISMATCH');
    assert.equal(res.body.detail.slot, 'equip2');
  });

  test('F8.5: backend/.env.example configures OCR_ENGINE_* and OCR_MAX_CONCURRENT', (t) => {
    if (!requireStrict(t)) return;
    const envEx = fs.readFileSync(path.join(REPO_ROOT, 'backend', '.env.example'), 'utf8');
    assert.match(envEx, /OCR_ENGINE_URL/);
    assert.match(envEx, /OCR_ENGINE_TOKEN/);
    assert.match(envEx, /OCR_ENGINE_TIMEOUT_MS/);
    assert.match(envEx, /OCR_MAX_CONCURRENT/);
  });

  // F9: Client 5-Slot Uploader & Pre-Validation
  test('F9.1: client api.ts normalizes NEXT_PUBLIC_API_URL and StudentOcrUploader wires 5 slots to /ocr', async (t) => {
    const apiPath = pathToFileURL(path.join(REPO_ROOT, 'client', 'src', 'lib', 'api.ts')).href;
    const probe = `import { API_BASE } from ${JSON.stringify(apiPath)}; console.log(API_BASE);`;
    const checkApi = (nextUrl) => {
      const env = { ...process.env };
      if (nextUrl === undefined) delete env.NEXT_PUBLIC_API_URL;
      else env.NEXT_PUBLIC_API_URL = nextUrl;
      return execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
        cwd: REPO_ROOT,
        env,
        encoding: 'utf8',
      }).trim();
    };
    assert.equal(checkApi(undefined), 'https://api.plan4ai.fyi/api');
    assert.equal(checkApi('http://localhost:4000'), 'http://localhost:4000/api');
    assert.equal(checkApi('http://127.0.0.1:3000/api/'), 'http://127.0.0.1:3000/api');

    if (E2E_STRICT) {
      const uploaderSrc = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'components', 'archive', 'StudentOcrUploader.tsx'), 'utf8');
      for (const marker of ['API_BASE', '/ocr', 'main', 'equip1', 'equip2', 'equip3', 'favorite', 'paste', 'needsReview', 'SCENE_MISMATCH']) {
        assert.equal(uploaderSrc.includes(marker), true, `StudentOcrUploader missing ${marker}`);
      }
    }

    if (E2E_LIVE) {
      const res = await fetch(`${CLIENT_URL}/archive`);
      assert.equal(res.status, 200);
    }
    if (!E2E_STRICT && !E2E_LIVE) {
      // api.ts subprocess checks already verified above in standalone mode
      assert.ok(t);
    }
  });

  test('F9.2: client pre-validation constants, RegistrationModal needsReview UI, and engine 400 error contract align', async () => {
    const parserSrc = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'lib', 'ocr', 'studentOcrParser.ts'), 'utf8');
    assert.match(parserSrc, /export interface OcrErrorResponse/);
    assert.match(parserSrc, /OcrSlotName/);
    assert.match(parserSrc, /conflictingWith/);

    const lowRes = await postMultipart(`${engineBase}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(1279, 720), filename: 'low.png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(lowRes.status, 400);
    assertValidError(lowRes.body);
    assert.equal(lowRes.body.code, 'LOW_RESOLUTION');

    if (E2E_STRICT) {
      const uploaderSrc = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'components', 'archive', 'StudentOcrUploader.tsx'), 'utf8');
      for (const token of ['8 * 1024 * 1024', '1280', '720', '16 / 9', '21 / 9', '0.02', 'SCENE_MISMATCH', 'SLOT_DUPLICATE']) {
        assert.equal(uploaderSrc.includes(token), true, `StudentOcrUploader missing ${token}`);
      }
      const modalSrc = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'components', 'archive', 'RegistrationModal.tsx'), 'utf8');
      assert.match(modalSrc, /_needsReview/);
      assert.match(modalSrc, /clearNeedsReview/);
    }
  });

  test('F9.3: multipart HTTP upload preserves exact raw image bytes without Canvas downscale', async () => {
    const original = makePngBuffer(1920, 1080, {
      tags: { scene: 'student_info' },
      targetBytes: 1_500_000,
    });
    assert.equal(original.length, 1_500_000);
    const res = await postMultipart(`${harness.backendUrl}/api/ocr`, {
      files: [{ field: 'main', buffer: original, filename: 'raw_1_5mb.png', mime: 'image/png' }],
    });
    assert.equal(res.status, 200);
    assert.equal(harness.metrics.lastReceivedParts.length, 1);
    assert.equal(harness.metrics.lastReceivedParts[0].byteLength, original.length);
    assert.equal(harness.metrics.lastReceivedParts[0].buffer.equals(original), true);

    if (E2E_STRICT) {
      const uploaderSrc = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'components', 'archive', 'StudentOcrUploader.tsx'), 'utf8');
      assert.doesNotMatch(uploaderSrc, /toDataURL|toBlob|createElement\(['"]canvas['"]\)/);
    }
    if (E2E_LIVE) {
      const localGuide = fs.readFileSync(path.join(REPO_ROOT, 'client', 'public', 'guides', 'ocr', 'student_info.png'));
      const liveGuide = await fetch(`${CLIENT_URL}/guides/ocr/student_info.png`);
      assert.equal(liveGuide.status, 200);
      const liveBuf = Buffer.from(await liveGuide.arrayBuffer());
      assert.equal(liveBuf.length, localGuide.length);
    }
  });

  test('F9.4: client/public/guides/ocr/ contains valid PNG guide thumbnails', (t) => {
    if (!requireStrict(t)) return;
    const guidesDir = path.join(REPO_ROOT, 'client', 'public', 'guides', 'ocr');
    assert.equal(fs.existsSync(guidesDir), true, 'Missing client/public/guides/ocr');
    for (const file of ['student_info.png', 'equipment_modal.png', 'favorite_popup.png']) {
      const p = path.join(guidesDir, file);
      assert.equal(fs.existsSync(p), true, `Missing guide ${file}`);
      const info = inspectImageBuffer(fs.readFileSync(p));
      assert.equal(info?.format, 'png', `Guide ${file} must be valid PNG`);
      assert.ok(info.width > 0 && info.height > 0);
    }
  });

  test('F9.5: live client responds on CLIENT_URL and serves guide thumbnails', async (t) => {
    if (!requireLive(t)) return;
    const res = await fetch(CLIENT_URL);
    assert.equal(res.status, 200);
    const guide = await fetch(`${CLIENT_URL}/guides/ocr/equipment_modal.png`);
    assert.equal(guide.status, 200);
    const info = inspectImageBuffer(Buffer.from(await guide.arrayBuffer()));
    assert.equal(info?.format, 'png');
  });

  // F10: Client NIM Removal, OcrMeta, RegistrationModal & API_BASE
  test('F10.1: studentOcrParser exports findStudentMasterByName & mapOcrDataToFormValues without legacy LLM helpers', () => {
    assert.equal(typeof parserMod.findStudentMasterByName, 'function');
    assert.equal(typeof parserMod.mapOcrDataToFormValues, 'function');
    assert.equal(parserMod.extractJsonObject, undefined);
    const parserSrc = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'lib', 'ocr', 'studentOcrParser.ts'), 'utf8');
    assert.match(parserSrc, /export interface OcrMeta/);
    assert.match(parserSrc, /export interface OcrErrorResponse/);
  });

  test('F10.2: mapOcrDataToFormValues maps favoriteItem -> equipment.slot4 accurately', () => {
    const master = [{ id: 10075, name: '하나코(수영복)' }];
    const withFav = parserMod.mapOcrDataToFormValues(loadMock('success_200.json').data, master);
    assert.equal(withFav.studentId, 10075);
    assert.deepEqual(withFav.equipment.slot4, { tier: 2, level: 1 });

    const noFav = parserMod.mapOcrDataToFormValues(loadMock('needs_review_200.json').data, [{ id: 10001, name: '아루' }]);
    assert.equal(noFav.equipment.slot4, null);
  });

  test('F10.3: mapOcrDataToFormValues maps releaseLevel:null and bondRank:null cleanly', () => {
    const mapped = parserMod.mapOcrDataToFormValues(loadMock('needs_review_200.json').data, [{ id: 10001, name: '아루' }]);
    assert.equal(mapped.bondRank, undefined);
    assert.equal(mapped.potentialLevels.maxHP, null);
    assert.equal(mapped.potentialLevels.attackPower, 15);
    assert.equal(mapped.equipment.slot3, null);
  });

  test('F10.4: NIM Edge routes deleted, OcrMeta exported, and NEXT_PUBLIC_API_URL honored', (t) => {
    if (!requireStrict(t)) return;
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'client', 'src', 'app', 'api', 'ocr', 'route.ts')), false);
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'client', 'src', 'lib', 'ocr', 'prompts.ts')), false);
    const parserSrc = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'lib', 'ocr', 'studentOcrParser.ts'), 'utf8');
    assert.match(parserSrc, /export interface OcrMeta/);
    const apiSrc = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'lib', 'api.ts'), 'utf8');
    assert.match(apiSrc, /NEXT_PUBLIC_API_URL/);
  });

  test('F10.5: client production build passes (next build)', (t) => {
    if (!requireStrict(t)) return;
    const t0 = Date.now() - 1000;
    runClientScript('next/dist/bin/next', ['build'], { timeout: 180000 });
    const buildIdPath = path.join(REPO_ROOT, 'client', '.next', 'BUILD_ID');
    assert.equal(fs.existsSync(buildIdPath), true, 'Expected client/.next/BUILD_ID after next build');
    assert.ok(fs.statSync(buildIdPath).mtimeMs >= t0, 'Expected fresh BUILD_ID from current next build');
  });

  // F11: Win11 / cloudflared / Zero Trust Guide & Docs-Vault Sync
  test('F11.1: imageOffsets.json is valid JSON and git working tree leaves protected paths clean', () => {
    const snap = snapshotProtectedPaths();
    assert.equal(snap['client/src/data/imageOffsets.json'].exists, true);
    const offsets = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'data', 'imageOffsets.json'), 'utf8'));
    assert.equal(typeof offsets, 'object');
    assert.ok(Object.keys(offsets).length > 0);
    assert.equal(runGit(['diff', '--', ...PROTECTED_PATHS]), '');
  });

  test('F11.2: preserved browser localStorage keys remain referenced in client stores', () => {
    const hits = scanFilesForPatterns(['client/src'], PRESERVED_STORAGE_KEYS.map((k) => new RegExp(k)));
    const foundPatterns = new Set(hits.map((h) => h.pattern));
    for (const k of PRESERVED_STORAGE_KEYS) {
      assert.equal(foundPatterns.has(k), true, `Missing preserved storage key ${k}`);
    }
  });

  test('F11.3: legacy Edge /api/ocr & prompts removed and all .env.example files free of NVIDIA keys', (t) => {
    if (!requireStrict(t)) return;
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'client', 'src', 'app', 'api', 'ocr', 'route.ts')), false);
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'client', 'src', 'lib', 'ocr', 'prompts.ts')), false);
    for (const rel of ['ocr-engine/.env.example', 'backend/.env.example', 'client/.env.example']) {
      const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      assert.doesNotMatch(content, /NVIDIA_API_KEY|integrate\.api\.nvidia\.com|nvapi-/i, `Residual NVIDIA ref in ${rel}`);
    }
  });

  test('F11.4: Windows 11 + cloudflared + Cloudflare Zero Trust Access guide exists', (t) => {
    if (!requireStrict(t)) return;
    const excluded = new Set(['student-ocr-selfhost-plan.md', 'api-spec.md', 'dev-log.md', 'troubleshooting.md']);
    const docs = fs.readdirSync(path.join(REPO_ROOT, 'docs-vault')).filter((f) => f.endsWith('.md') && !excluded.has(f));
    const hasGuide = docs.some((f) => {
      const text = fs.readFileSync(path.join(REPO_ROOT, 'docs-vault', f), 'utf8');
      return /cloudflared/i.test(text) && /Zero Trust/i.test(text);
    });
    assert.equal(hasGuide, true, 'Missing Win11 + cloudflared + Zero Trust guide in docs-vault/');
  });

  test('F11.5: docs-vault/api-spec.md and dev-log.md reflect completed self-hosted OCR API', (t) => {
    if (!requireStrict(t)) return;
    const apiSpec = fs.readFileSync(path.join(REPO_ROOT, 'docs-vault', 'api-spec.md'), 'utf8');
    assert.match(apiSpec, /\/v1\/recognize/);
    assert.match(apiSpec, /\/api\/ocr\/status/);
    assert.match(apiSpec, /5슬롯|equip1/);

    const devLog = fs.readFileSync(path.join(REPO_ROOT, 'docs-vault', 'dev-log.md'), 'utf8');
    const withoutPlanning = devLog.replace(/### 학생 스크린샷 인식 자체 API 전환 기획[\s\S]*?(?=\n###|\n---|$)/, '');
    assert.match(withoutPlanning, /ocr-engine|\/v1\/recognize|자체\s*OCR/i, 'Missing implementation dev-log entry beyond planning note');
    assert.match(withoutPlanning, /완료|구현|전환|적용/);
  });
});
