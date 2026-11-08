const assert = require('node:assert');
const test = require('node:test');
const { getSchemaConfig, setSchemaConfig, syncStudentGiftAffinity, getStudentMasterDB, setStudentMasterDB } = require('../config/masterDB');

test('Gift-Master Affinity Sync Unit Tests', async (t) => {
  // Backup existing schemaConfig & studentMasterDB
  const originalSchema = JSON.parse(JSON.stringify(getSchemaConfig()));
  const originalMasterDB = JSON.parse(JSON.stringify(getStudentMasterDB()));

  t.after(() => {
    setSchemaConfig(originalSchema);
    setStudentMasterDB(originalMasterDB);
  });

  await t.test('1. syncStudentGiftAffinity correctly maps student to level2, level3, and level4', () => {
    const mockSchema = {
      ...originalSchema,
      gifts: [
        { key: 'gift_001', name: '달걀 공예품', tier: 'HighGrade', affinity: { level2: [10], level3: [20], level4: [30] } },
        { key: 'gift_002', name: '보드게임', tier: 'HighGrade', affinity: { level2: [], level3: [10], level4: [] } },
        { key: 'gift_003', name: '덤벨 세트', tier: 'HighGrade', affinity: { level2: [], level3: [], level4: [] } },
      ]
    };
    setSchemaConfig(mockSchema);

    // Sync student 99
    syncStudentGiftAffinity(99, {
      level4: ['gift_001'],
      level3: ['gift_002'],
      level2: ['gift_003']
    });

    const updated = getSchemaConfig().gifts;
    const g1 = updated.find(g => g.key === 'gift_001');
    const g2 = updated.find(g => g.key === 'gift_002');
    const g3 = updated.find(g => g.key === 'gift_003');

    // Student 99 should be added
    assert.ok(g1.affinity.level4.includes(99), 'gift_001 level4 should have student 99');
    assert.ok(g2.affinity.level3.includes(99), 'gift_002 level3 should have student 99');
    assert.ok(g3.affinity.level2.includes(99), 'gift_003 level2 should have student 99');

    // Existing students must be preserved
    assert.deepStrictEqual(g1.affinity.level2, [10]);
    assert.deepStrictEqual(g1.affinity.level3, [20]);
    assert.deepStrictEqual(g1.affinity.level4, [30, 99]);
    assert.deepStrictEqual(g2.affinity.level3, [10, 99]);
  });

  await t.test('2. Updating preferredGifts removes old affinities and assigns new ones', () => {
    // Student 99 changes preference: moves gift_001 from Lv.4 to Lv.2, removes gift_002, adds gift_003 to Lv.4
    syncStudentGiftAffinity(99, {
      level4: ['gift_003'],
      level3: [],
      level2: ['gift_001']
    });

    const updated = getSchemaConfig().gifts;
    const g1 = updated.find(g => g.key === 'gift_001');
    const g2 = updated.find(g => g.key === 'gift_002');
    const g3 = updated.find(g => g.key === 'gift_003');

    // gift_001 should not be in level4, but in level2
    assert.strictEqual(g1.affinity.level4.includes(99), false);
    assert.strictEqual(g1.affinity.level2.includes(99), true);

    // gift_002 should not have student 99 anywhere
    assert.strictEqual(g2.affinity.level2.includes(99), false);
    assert.strictEqual(g2.affinity.level3.includes(99), false);
    assert.strictEqual(g2.affinity.level4.includes(99), false);

    // gift_003 should be in level4
    assert.strictEqual(g3.affinity.level4.includes(99), true);
    assert.strictEqual(g3.affinity.level2.includes(99), false);
  });

  await t.test('3. Mutual exclusivity: single gift cannot be in multiple levels simultaneously', () => {
    // If user somehow passes same key in level4 and level2, level4 takes precedence
    syncStudentGiftAffinity(99, {
      level4: ['gift_001'],
      level3: [],
      level2: ['gift_001']
    });

    const g1 = getSchemaConfig().gifts.find(g => g.key === 'gift_001');
    assert.strictEqual(g1.affinity.level4.includes(99), true, 'Should be in level4');
    assert.strictEqual(g1.affinity.level2.includes(99), false, 'Should NOT be in level2 simultaneously');
  });

  await t.test('4. Case-insensitive key matching and deduplication/sorting', () => {
    syncStudentGiftAffinity(5, {
      level4: ['GIFT_001'],
      level3: [],
      level2: []
    });

    const g1 = getSchemaConfig().gifts.find(g => g.key === 'gift_001');
    assert.ok(g1.affinity.level4.includes(5), 'Uppercase key GIFT_001 should match gift_001');
    // Ensure array is sorted: [5, 30, 99]
    assert.deepStrictEqual(g1.affinity.level4, [5, 30, 99]);
  });

  await t.test('5. Undefined or null preferredGifts skips without modifying any gifts', () => {
    const beforeGifts = JSON.stringify(getSchemaConfig().gifts);
    syncStudentGiftAffinity(99, undefined);
    syncStudentGiftAffinity(99, null);
    const afterGifts = JSON.stringify(getSchemaConfig().gifts);
    assert.strictEqual(beforeGifts, afterGifts, 'Schema gifts should not change on null/undefined');
  });

  await t.test('6. Student deletion cleans up all gift affinities (no orphan IDs)', () => {
    syncStudentGiftAffinity(99, { level2: [], level3: [], level4: [] });

    const updated = getSchemaConfig().gifts;
    for (const g of updated) {
      assert.strictEqual(g.affinity.level2.includes(99), false);
      assert.strictEqual(g.affinity.level3.includes(99), false);
      assert.strictEqual(g.affinity.level4.includes(99), false);
    }
  });

  await t.test('7. Master route simulation (POST, PUT, DELETE with sync)', () => {
    // Reset schema with clean gifts
    setSchemaConfig({
      ...originalSchema,
      gifts: [
        { key: 'gift_test_a', name: 'Test Gift A', tier: 'Normal', affinity: { level2: [], level3: [], level4: [] } },
        { key: 'gift_test_b', name: 'Test Gift B', tier: 'HighGrade', affinity: { level2: [], level3: [], level4: [] } }
      ]
    });
    setStudentMasterDB([
      { id: 1, name: 'Student 1', school: 'Trinity', skills: [], portraitUrls: [] },
      { id: 2, name: 'Student 2', school: 'Gehenna', skills: [], portraitUrls: [] }
    ]);

    // Simulate POST /students with preferredGifts
    const db = getStudentMasterDB();
    const maxId = db.reduce((max, s) => (s.id && s.id < 1000000 ? Math.max(max, s.id) : max), 0);
    const newId = maxId + 1; // 3
    const reqBody = {
      name: 'New Student 3',
      school: 'Millennium',
      preferredGifts: {
        level4: ['gift_test_a'],
        level3: ['gift_test_b'],
        level2: []
      }
    };

    const { preferredGifts, ...studentData } = reqBody;
    const newStudent = { ...studentData, id: newId };
    db.push(newStudent);
    setStudentMasterDB(db);
    syncStudentGiftAffinity(newId, preferredGifts);

    // Verify student stored without redundant preferredGifts
    const savedStudent = getStudentMasterDB().find(s => s.id === 3);
    assert.ok(savedStudent, 'Student 3 must exist in DB');
    assert.strictEqual(savedStudent.preferredGifts, undefined, 'Redundant preferredGifts not stored in student record');

    // Verify gift affinities synced
    let ga = getSchemaConfig().gifts.find(g => g.key === 'gift_test_a');
    let gb = getSchemaConfig().gifts.find(g => g.key === 'gift_test_b');
    assert.deepStrictEqual(ga.affinity.level4, [3]);
    assert.deepStrictEqual(gb.affinity.level3, [3]);

    // Simulate PUT /students/:id with changed preferredGifts
    const putBody = {
      name: 'New Student 3 Updated',
      school: 'Millennium',
      preferredGifts: {
        level4: [],
        level3: ['gift_test_a'],
        level2: ['gift_test_b']
      }
    };
    const { preferredGifts: putGifts, ...putData } = putBody;
    let currentDb = getStudentMasterDB();
    currentDb = currentDb.map(s => s.id === 3 ? { ...putData, id: 3 } : s);
    setStudentMasterDB(currentDb);
    syncStudentGiftAffinity(3, putGifts);

    ga = getSchemaConfig().gifts.find(g => g.key === 'gift_test_a');
    gb = getSchemaConfig().gifts.find(g => g.key === 'gift_test_b');
    assert.deepStrictEqual(ga.affinity.level4, []);
    assert.deepStrictEqual(ga.affinity.level3, [3]);
    assert.deepStrictEqual(gb.affinity.level2, [3]);

    // Simulate PUT /students/:id WITHOUT preferredGifts (backward compatibility)
    const legacyPutBody = {
      name: 'New Student 3 Renamed',
      school: 'Millennium'
    };
    const { preferredGifts: legacyGifts, ...legacyData } = legacyPutBody;
    currentDb = getStudentMasterDB();
    currentDb = currentDb.map(s => s.id === 3 ? { ...legacyData, id: 3 } : s);
    setStudentMasterDB(currentDb);
    if (legacyGifts !== undefined && legacyGifts !== null) {
      syncStudentGiftAffinity(3, legacyGifts);
    }
    // Affinities should remain untouched!
    ga = getSchemaConfig().gifts.find(g => g.key === 'gift_test_a');
    assert.deepStrictEqual(ga.affinity.level3, [3], 'Affinity must stay intact for legacy PUT without preferredGifts');

    // Simulate DELETE /students/:id
    currentDb = getStudentMasterDB().filter(s => s.id !== 3);
    setStudentMasterDB(currentDb);
    syncStudentGiftAffinity(3, { level2: [], level3: [], level4: [] });

    assert.strictEqual(getStudentMasterDB().find(s => s.id === 3), undefined);
    ga = getSchemaConfig().gifts.find(g => g.key === 'gift_test_a');
    gb = getSchemaConfig().gifts.find(g => g.key === 'gift_test_b');
    assert.deepStrictEqual(ga.affinity.level3, [], 'No orphan ID in gift_test_a');
    assert.deepStrictEqual(gb.affinity.level2, [], 'No orphan ID in gift_test_b');
  });

  await t.test('8. Robustness: handles non-object preferredGifts, strings IDs in existing schema, whitespace, null gifts', () => {
    setSchemaConfig({
      ...originalSchema,
      gifts: [
        null, // null entry in gifts
        { key: 'gift_trim', name: 'Trim Test', tier: 'Normal', affinity: { level2: ['77', 88], level3: ['77'], level4: [] } },
        { key: 'gift_num_l3', name: 'Numeric Key Test', tier: 'HighGrade', affinity: { level2: [], level3: [], level4: [] } }
      ]
    });

    // 1. Non-object or primitive preferredGifts should not crash
    assert.doesNotThrow(() => syncStudentGiftAffinity(77, 'not-an-object'));
    assert.doesNotThrow(() => syncStudentGiftAffinity(77, 12345));
    assert.doesNotThrow(() => syncStudentGiftAffinity(77, true));
    assert.doesNotThrow(() => syncStudentGiftAffinity('invalid-id', { level2: ['gift_trim'] }));

    // 2. Whitespace in gift key & String student ID removal
    syncStudentGiftAffinity(77, {
      level4: ['  GIFT_TRIM  '],
      level3: [123], // non-string or numeric representation in level3
      level2: []
    });

    const updated = getSchemaConfig().gifts;
    const gTrim = updated.find(g => g && g.key === 'gift_trim');
    assert.ok(gTrim, 'gift_trim should exist');
    // Student 77 should have been removed from level2 (where it was string '77') and level3, and assigned to level4
    assert.deepStrictEqual(gTrim.affinity.level4, [77]);
    assert.deepStrictEqual(gTrim.affinity.level3, []);
    assert.deepStrictEqual(gTrim.affinity.level2, [88]);
    // Ensure all stored IDs are strictly numbers
    assert.strictEqual(typeof gTrim.affinity.level4[0], 'number');
    assert.strictEqual(typeof gTrim.affinity.level2[0], 'number');
  });

  await t.test('9. Affinity array sanitation: filters out null, NaN, 0, negatives, and ignores non-positive student IDs', () => {
    setSchemaConfig({
      ...originalSchema,
      gifts: [
        {
          key: 'gift_polluted',
          name: 'Polluted Test',
          tier: 'Normal',
          affinity: { level2: [null, 0, 'NaN', -5, 3.14, 10, ''], level3: [undefined, 20], level4: [] }
        }
      ]
    });

    // Ignored when studentId is <= 0 or invalid
    syncStudentGiftAffinity(0, { level4: ['gift_polluted'] });
    syncStudentGiftAffinity(-99, { level4: ['gift_polluted'] });
    syncStudentGiftAffinity('invalid', { level4: ['gift_polluted'] });

    let g = getSchemaConfig().gifts.find(item => item && item.key === 'gift_polluted');
    // None of 0 or -99 should be added
    assert.deepStrictEqual(g.affinity.level4, []);

    // Now sync with valid student 50, and ensure all dirty items (null, 0, NaN, negative, float) were cleaned
    syncStudentGiftAffinity(50, { level4: ['gift_polluted'], level3: [], level2: [] });
    g = getSchemaConfig().gifts.find(item => item && item.key === 'gift_polluted');
    assert.deepStrictEqual(g.affinity.level4, [50]);
    assert.deepStrictEqual(g.affinity.level3, [20]);
    assert.deepStrictEqual(g.affinity.level2, [10]);
    // Check that every ID is strictly a positive integer
    for (const id of [...g.affinity.level2, ...g.affinity.level3, ...g.affinity.level4]) {
      assert.ok(Number.isInteger(id) && id > 0, `ID ${id} must be a positive integer`);
    }
  });

  await t.test('10. Garbage/null key entries in preferredGifts arrays are safely ignored', () => {
    setSchemaConfig({
      ...originalSchema,
      gifts: [
        { key: 'gift_clean', name: 'Clean Test', tier: 'HighGrade', affinity: { level2: [], level3: [], level4: [] } }
      ]
    });

    syncStudentGiftAffinity(42, {
      level4: [null, undefined, '', '   ', 'null', 'undefined', 'gift_clean'],
      level3: [null],
      level2: []
    });

    const g = getSchemaConfig().gifts.find(item => item && item.key === 'gift_clean');
    assert.deepStrictEqual(g.affinity.level4, [42]);
    assert.deepStrictEqual(g.affinity.level3, []);
    assert.deepStrictEqual(g.affinity.level2, []);
  });

  await t.test('11. Non-integer student IDs (floats, alphanumeric strings) and Array preferredGifts are safely ignored', () => {
    setSchemaConfig({
      ...originalSchema,
      gifts: [
        { key: 'gift_guard', name: 'Guard Test', tier: 'HighGrade', affinity: { level2: [], level3: [88], level4: [] } }
      ]
    });

    // 1. Array preferredGifts should NOT wipe out student 88's affinities
    syncStudentGiftAffinity(88, []);
    syncStudentGiftAffinity(88, ['gift_guard']);
    let g = getSchemaConfig().gifts.find(item => item && item.key === 'gift_guard');
    assert.deepStrictEqual(g.affinity.level3, [88], 'Array preferredGifts must be ignored without wiping out affinities');

    // 2. Float and alphanumeric student IDs should not be processed
    syncStudentGiftAffinity(3.14, { level4: ['gift_guard'] });
    syncStudentGiftAffinity('3.14', { level4: ['gift_guard'] });
    syncStudentGiftAffinity('88abc', { level4: ['gift_guard'] });
    g = getSchemaConfig().gifts.find(item => item && item.key === 'gift_guard');
    assert.deepStrictEqual(g.affinity.level4, [], 'Non-integer student IDs must not be added');
  });

  await t.test('12. Matching gifts by gift name as well as key in syncStudentGiftAffinity', () => {
    setSchemaConfig({
      ...originalSchema,
      gifts: [
        { key: 'gift_name_match', name: '고급 수제 쿠키', tier: 'HighGrade', affinity: { level2: [], level3: [], level4: [] } }
      ]
    });

    // Match by gift.name
    syncStudentGiftAffinity(95, {
      level4: ['고급 수제 쿠키'],
      level3: [],
      level2: []
    });

    const g = getSchemaConfig().gifts.find(item => item && item.key === 'gift_name_match');
    assert.deepStrictEqual(g.affinity.level4, [95], 'Student 95 should match gift by name');
  });

  await t.test('13. Master route handles stringified JSON preferredGifts gracefully', () => {
    setSchemaConfig({
      ...originalSchema,
      gifts: [
        { key: 'gift_json_str', name: 'JSON String Test', tier: 'Normal', affinity: { level2: [], level3: [], level4: [] } }
      ]
    });

    // Simulate route stringified preferredGifts
    let rawPreferred = JSON.stringify({ level4: ['gift_json_str'], level3: [], level2: [] });
    let parsedGifts = rawPreferred;
    if (typeof rawPreferred === 'string') {
      try { parsedGifts = JSON.parse(rawPreferred); } catch (e) {}
    }
    syncStudentGiftAffinity(70, parsedGifts);

    const g = getSchemaConfig().gifts.find(item => item && item.key === 'gift_json_str');
    assert.deepStrictEqual(g.affinity.level4, [70], 'Student 70 should be synced from parsed stringified JSON');
  });
});
