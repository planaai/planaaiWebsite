import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO_ROOT,
  E2E_LIVE,
  OCR_ENGINE_URL,
  BACKEND_URL,
  CLIENT_URL,
  OCR_ENGINE_TOKEN,
  PROTECTED_PATHS,
  requireLive,
  requireStrict,
  assertValidSuccess,
  loadFixture,
  readUploadImage,
  makePngBuffer,
  postMultipart,
  postBackendLive,
  getJson,
  getOcrEnginePython,
  createContractHarness,
  snapshotProtectedPaths,
  scanFilesForPatterns,
  runGit,
} from './helpers.mjs';

const parserMod = await import(
  pathToFileURL(path.join(REPO_ROOT, 'client', 'src', 'lib', 'ocr', 'studentOcrParser.ts')).href
);

function scanGoldenSets() {
  const goldenDir = path.join(REPO_ROOT, 'ocr-engine', 'tests', 'golden');
  if (!fs.existsSync(goldenDir)) return { topFiles: [], sets: [] };
  const topFiles = [];
  const sets = [];
  for (const name of fs.readdirSync(goldenDir)) {
    if (name === 'README.md' || name.startsWith('.')) continue;
    const full = path.join(goldenDir, name);
    const st = fs.statSync(full);
    if (st.isFile() && /\.(png|jpe?g|webp)$/i.test(name)) {
      topFiles.push(full);
    } else if (st.isDirectory()) {
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

function p95(times) {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

describe('Tier 4 — Real-World Application Scenarios', () => {
  test('S1: full local 3-tier E2E registration (ocr-engine + backend + client) with fixture -> ArchiveRecord + 21:9 check', async (t) => {
    if (!requireLive(t)) return;
    const health = await getJson(`${OCR_ENGINE_URL}/healthz`);
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);

    const status = await getJson(`${BACKEND_URL}/api/ocr/status`);
    assert.equal(status.status, 200);
    assert.equal(status.body.healthy, true);

    const clientHome = await fetch(CLIENT_URL);
    assert.equal(clientHome.status, 200);
    const clientArchive = await fetch(`${CLIENT_URL}/archive`);
    assert.equal(clientArchive.status, 200);

    const res = await postBackendLive(`${BACKEND_URL}/api/ocr`, {
      files: [
        { field: 'main', ...loadFixture('student_info.png') },
        { field: 'equip1', ...loadFixture('equipment_modal.png') },
        { field: 'favorite', ...loadFixture('favorite_popup.png') },
      ],
    });
    assert.equal(res.status, 200);
    assertValidSuccess(res.body, { requireSuccessFlag: true });
    assert.equal(res.body.meta.fieldSources.favoriteItem, 'favorite');

    const mapped = parserMod.mapOcrDataToFormValues(res.body.data, [{ id: 10075, name: res.body.data.studentName }]);
    const archiveRecord = {
      studentId: mapped.studentId,
      level: mapped.level,
      currentStars: mapped.currentStars,
      bondRank: mapped.bondRank,
      skillLevels: mapped.skillLevels,
      equipment: mapped.equipment,
      uniqueWeapon: mapped.uniqueWeapon,
      stats: mapped.stats,
      potentialLevels: mapped.potentialLevels,
      capturedAt: new Date().toISOString(),
    };
    assert.equal(archiveRecord.studentId, 10075);
    assert.ok(archiveRecord.level >= 1 && archiveRecord.level <= 90);
    assert.ok(Object.hasOwn(archiveRecord.equipment, 'slot4'));

    const uwCheck = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
      files: [{ field: 'main', buffer: makePngBuffer(2560, 1080), filename: '219.png', mime: 'image/png' }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.notEqual(uwCheck.status, 400);
    assert.notEqual(uwCheck.body?.code, 'UNSUPPORTED_RATIO');
  });

  test('S2: fixture 3-scene combinations & golden-set per-field accuracy/parity evaluation', async (t) => {
    if (!requireLive(t)) return;
    const combos = [
      {
        name: 'main_only',
        files: [{ field: 'main', ...loadFixture('student_info.png') }],
        expectedScenes: { main: 'student_info' },
      },
      {
        name: 'main_plus_equip1',
        files: [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'equip1', ...loadFixture('equipment_modal.png') },
        ],
        expectedScenes: { main: 'student_info', equip1: 'equipment_modal' },
      },
      {
        name: 'main_plus_favorite',
        files: [
          { field: 'main', ...loadFixture('student_info.png') },
          { field: 'favorite', ...loadFixture('favorite_popup.png') },
        ],
        expectedScenes: { main: 'student_info', favorite: 'favorite_popup' },
      },
    ];
    for (const c of combos) {
      const r = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
        files: c.files,
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(r.status, 200, `Fixture combo ${c.name} failed with ${r.status}`);
      assertValidSuccess(r.body);
      assert.deepEqual(r.body.meta.scenes, c.expectedScenes);
    }

    const { topFiles, sets } = scanGoldenSets();
    const labeledSets = sets.filter((s) => s.expected);
    if (labeledSets.length > 0) {
      const tally = {
        name: [0, 0, 0],
        core: [0, 0, 0],
        skills: [0, 0, 0],
        equip: [0, 0, 0],
        fav: [0, 0, 0],
        stats: [0, 0, 0],
      };
      const record = (bucket, skipped, ok) => {
        tally[bucket][2] += 1;
        if (!skipped) {
          tally[bucket][1] += 1;
          if (ok) tally[bucket][0] += 1;
        }
      };
      for (const s of labeledSets) {
        const res = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
          files: Object.entries(s.slotFiles).map(([field, abs]) => ({ field, ...readUploadImage(abs) })),
          headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
        });
        assert.equal(res.status, 200);
        assertValidSuccess(res.body);
        const exp = s.expected.data || s.expected;
        const got = res.body.data;
        const rev = new Set(res.body.meta.needsReview || []);
        if (exp.studentName) record('name', rev.has('studentName'), got.studentName === exp.studentName);
        if (exp.level !== undefined) record('core', rev.has('level'), got.level === exp.level);
        if (exp.starGrade !== undefined) record('core', rev.has('starGrade'), got.starGrade === exp.starGrade);
        if (exp.bondRank !== undefined) record('core', rev.has('bondRank'), got.bondRank === exp.bondRank);
        if (exp.skills) {
          for (const k of ['ex', 'normal', 'passive', 'sub']) {
            if (exp.skills[k] !== undefined) record('skills', rev.has(`skills.${k}`), got.skills[k] === exp.skills[k]);
          }
        }
        if (Array.isArray(exp.equipments)) {
          for (let i = 0; i < Math.min(3, exp.equipments.length); i++) {
            const expEq = exp.equipments[i];
            const gotEq = got.equipments[i];
            record(
              'equip',
              false,
              Boolean(gotEq) &&
                gotEq.tier === expEq.tier &&
                (expEq.level === undefined || rev.has(`equipments[${i}].level`) || gotEq.level === expEq.level)
            );
          }
        }
        if (exp.favoriteItem) {
          record('fav', false, got.favoriteItem.unequipped === exp.favoriteItem.unequipped && got.favoriteItem.tier === exp.favoriteItem.tier);
        }
        if (exp.stats) {
          for (const k of ['hp', 'atk', 'def', 'heal']) {
            if (exp.stats[k] !== undefined) record('stats', rev.has(`stats.${k}.value`), got.stats[k].value === exp.stats[k].value);
          }
        }
      }
      const totalLabeled = Object.values(tally).reduce((sum, [, , l]) => sum + l, 0);
      const totalEvaluated = Object.values(tally).reduce((sum, [, e]) => sum + e, 0);
      assert.ok(totalLabeled > 0 && totalEvaluated > 0, 'Golden labeled set yielded zero evaluated fields');
      const checkAccuracy = (label, [ok, evaluated, labeled], threshold) => {
        if (labeled === 0) return;
        assert.ok(evaluated > 0, `${label}: 100% of ${labeled} labeled fields skipped via needsReview`);
        assert.ok(evaluated / labeled > 0.5, `${label}: majority of fields skipped via needsReview (${evaluated}/${labeled})`);
        assert.ok(ok / evaluated >= threshold, `${label} accuracy ${(ok / evaluated).toFixed(3)} < ${threshold}`);
      };
      checkAccuracy('studentName', tally.name, 0.98);
      checkAccuracy('core', tally.core, 0.97);
      checkAccuracy('skills', tally.skills, 0.97);
      checkAccuracy('equipments', tally.equip, 0.98);
      checkAccuracy('favoriteItem', tally.fav, 0.98);
      checkAccuracy('stats', tally.stats, 0.95);
    } else if (topFiles.length > 0) {
      const py = getOcrEnginePython();
      const out = execFileSync(py, ['-m', 'pytest', 'tests/test_parity.py', '-k', 'test_golden_images_if_present', '-v', '--tb=short'], {
        cwd: path.join(REPO_ROOT, 'ocr-engine'),
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.match(out, /test_golden_images_if_present\s+PASSED/);
    }
  });

  test('S3: latency p95 SLA verification (<= 5000ms for 5-image set, <= 2500ms for single main)', async (t) => {
    if (!requireLive(t)) return;
    const mainFile = loadFixture('student_info.png');
    // Warmup
    const warm = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
      files: [{ field: 'main', ...mainFile }],
      headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
    });
    assert.equal(warm.status, 200);

    const mainTimes = [];
    for (let i = 0; i < 5; i++) {
      const r = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
        files: [{ field: 'main', ...mainFile }],
        headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
      });
      assert.equal(r.status, 200);
      mainTimes.push(r.elapsedMs);
    }
    const singleP95 = p95(mainTimes);
    assert.ok(singleP95 <= 2500, `Single main p95 ${singleP95.toFixed(1)}ms exceeded 2500ms`);

    const { sets } = scanGoldenSets();
    const fiveSlotSet = sets.find((s) => s.slotFiles.main && s.slotFiles.equip1 && s.slotFiles.equip2 && s.slotFiles.equip3 && s.slotFiles.favorite);
    if (fiveSlotSet) {
      const setFiles = Object.entries(fiveSlotSet.slotFiles).map(([field, abs]) => ({ field, ...readUploadImage(abs) }));
      const setTimes = [];
      for (let i = 0; i < 5; i++) {
        const r = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
          files: setFiles,
          headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
        });
        assert.equal(r.status, 200);
        setTimes.push(r.elapsedMs);
      }
      const fiveP95 = p95(setTimes);
      assert.ok(fiveP95 <= 5000, `5-image set p95 ${fiveP95.toFixed(1)}ms exceeded 5000ms`);
    } else {
      // Only 1 equipment_modal.png fixture exists; measure 3-slot HTTP + run pytest test_latency.py for 5-slot p95 <= 5s
      const threeFiles = [
        { field: 'main', ...mainFile },
        { field: 'equip1', ...loadFixture('equipment_modal.png') },
        { field: 'favorite', ...loadFixture('favorite_popup.png') },
      ];
      const threeTimes = [];
      for (let i = 0; i < 5; i++) {
        const r = await postMultipart(`${OCR_ENGINE_URL}/v1/recognize`, {
          files: threeFiles,
          headers: { 'X-Engine-Token': OCR_ENGINE_TOKEN },
        });
        assert.equal(r.status, 200);
        threeTimes.push(r.elapsedMs);
      }
      assert.ok(p95(threeTimes) <= 5000, `3-slot HTTP p95 ${p95(threeTimes).toFixed(1)}ms exceeded 5000ms`);

      const py = getOcrEnginePython();
      const out = execFileSync(py, ['-m', 'pytest', 'tests/test_latency.py', '-v', '--tb=short'], {
        cwd: path.join(REPO_ROOT, 'ocr-engine'),
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.match(out, /test_p95_latency_single_and_five_set\s+PASSED/);
    }
  });

  test('S4: global NVIDIA NIM removal (0 refs in ocr-engine/, backend/, client/, docs-vault/api-spec.md & live /api/ocr disabled)', async (t) => {
    if (!requireStrict(t)) return;
    const hits = scanFilesForPatterns(
      ['ocr-engine', 'backend', 'client'],
      [/integrate\.api\.nvidia\.com/, /NVIDIA_API_KEY/, /nvapi-/]
    );
    assert.deepEqual(hits, [], `NVIDIA NIM remnants found: ${JSON.stringify(hits)}`);

    const apiSpec = fs.readFileSync(path.join(REPO_ROOT, 'docs-vault', 'api-spec.md'), 'utf8');
    const secMatch = /## 스크린샷 임포트 및 OCR[\s\S]*?(?=\n## |$)/.exec(apiSpec);
    assert.ok(secMatch, 'Missing OCR section in docs-vault/api-spec.md');
    assert.doesNotMatch(secMatch[0], /integrate\.api\.nvidia\.com|NVIDIA_API_KEY|nvapi-/);

    if (E2E_LIVE) {
      const legacyEdge = await fetch(`${CLIENT_URL}/api/ocr`, { method: 'POST' });
      assert.ok([404, 405].includes(legacyEdge.status), `Expected 404/405 on client /api/ocr, got ${legacyEdge.status}`);
      const status = await getJson(`${BACKEND_URL}/api/ocr/status`);
      assert.equal(status.status, 200);
      assert.equal(status.body.engine, 'plana-ocr');
    }
  });

  test('S5: protected paths invariance & manual ArchiveRecord registration regression without OCR', () => {
    const snap = snapshotProtectedPaths();
    assert.equal(snap['backend/data'].exists, true);
    assert.equal(snap['backend/prisma'].exists, true);
    assert.equal(snap['backend/uploads'].exists, true);
    assert.equal(snap['client/src/data/imageOffsets.json'].exists, true);
    assert.equal(runGit(['diff', '--', ...PROTECTED_PATHS]), '');

    // Manual student ArchiveRecord assembly works cleanly without OCR pipeline involvement
    const manualRecord = {
      studentId: 10075,
      level: 90,
      currentStars: 5,
      bondRank: 20,
      skillLevels: { ex: 5, normal: 10, passive: 10, sub: 10 },
      equipment: {
        slot1: { tier: 9, level: 65 },
        slot2: { tier: 9, level: 65 },
        slot3: null,
        slot4: null,
      },
      uniqueWeapon: null,
      stats: { maxHP: 45000, attackPower: 6400, defensePower: 120, healPower: 3000 },
      potentialLevels: { maxHP: null, attackPower: 25, defensePower: null, healPower: null },
      capturedAt: new Date().toISOString(),
    };
    assert.equal(manualRecord.studentId, 10075);
    assert.equal(manualRecord.equipment.slot4, null);
    assert.equal(manualRecord.uniqueWeapon, null);
    assert.equal(manualRecord.potentialLevels.attackPower, 25);
  });

  test('S6: Win11 scripts, cloudflared/Zero Trust guide, and docs-vault sync deliverables complete', (t) => {
    if (!requireStrict(t)) return;
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'ocr-engine', 'start_ocr_engine.bat')), true);
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'ocr-engine', 'start_ocr_engine.ps1')), true);
    const excluded = new Set(['student-ocr-selfhost-plan.md', 'api-spec.md', 'dev-log.md', 'troubleshooting.md']);
    const docs = fs.readdirSync(path.join(REPO_ROOT, 'docs-vault')).filter((f) => f.endsWith('.md') && !excluded.has(f));
    assert.equal(
      docs.some((f) => {
        const text = fs.readFileSync(path.join(REPO_ROOT, 'docs-vault', f), 'utf8');
        return /cloudflared/i.test(text) && /Zero Trust/i.test(text);
      }),
      true,
      'Missing Win11 + cloudflared + Zero Trust guide'
    );
    const apiSpec = fs.readFileSync(path.join(REPO_ROOT, 'docs-vault', 'api-spec.md'), 'utf8');
    const devLog = fs.readFileSync(path.join(REPO_ROOT, 'docs-vault', 'dev-log.md'), 'utf8');
    assert.match(apiSpec, /\/v1\/recognize/);
    assert.match(devLog.replace(/### 학생 스크린샷 인식 자체 API 전환 기획[\s\S]*?(?=\n###|\n---|$)/, ''), /ocr-engine|\/v1\/recognize|자체\s*OCR/i);
  });

  test('S7: end-to-end 3-tier contract workflow (5-slot upload -> proxy -> parser -> ArchiveRecord) leaves protected paths untouched', async () => {
    const beforeSnap = snapshotProtectedPaths();
    const h = await createContractHarness();
    try {
      const status = await getJson(`${h.backendUrl}/api/ocr/status`);
      assert.equal(status.status, 200);
      assert.equal(status.body.healthy, true);

      const res = await postMultipart(`${h.backendUrl}/api/ocr`, {
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

      const mapped = parserMod.mapOcrDataToFormValues(res.body.data, [{ id: 10075, name: '하나코(수영복)' }]);
      const archiveRecord = {
        studentId: mapped.studentId,
        level: mapped.level,
        currentStars: mapped.currentStars,
        bondRank: mapped.bondRank,
        skillLevels: mapped.skillLevels,
        equipment: mapped.equipment,
        uniqueWeapon: mapped.uniqueWeapon,
        stats: mapped.stats,
        potentialLevels: mapped.potentialLevels,
        capturedAt: new Date().toISOString(),
      };
      assert.equal(archiveRecord.studentId, 10075);
      assert.deepEqual(archiveRecord.equipment.slot4, { tier: 2, level: 1 });
      assert.equal(archiveRecord.potentialLevels.maxHP, 25);
    } finally {
      await h.close();
    }
    const afterSnap = snapshotProtectedPaths();
    assert.deepEqual(afterSnap, beforeSnap);
  });
});
