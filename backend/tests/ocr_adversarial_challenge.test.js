const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  extractJsonObject,
  normalizeOcrData,
  toOptionalInt,
  toSkillLevel,
  DEFAULT_MODEL
} = require('../services/ocrService');
const ocrRouter = require('../routes/ocr');

// Helper to simulate Express route calls without TCP sockets
function simulateRoute({ method = 'POST', url = '/', body = {}, headers = {} } = {}) {
  return new Promise((resolve) => {
    let statusCode = 200;
    let headersSent = false;
    let ended = false;
    const listeners = {};

    const req = {
      method,
      url,
      body,
      headers,
      on: (event, handler) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
      },
      removeListener: (event, handler) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      }
    };

    const res = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(code) {
        statusCode = code;
      },
      get headersSent() {
        return headersSent;
      },
      get writableEnded() {
        return ended;
      },
      on: (event, handler) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
      },
      removeListener: (event, handler) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      },
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        headersSent = true;
        ended = true;
        resolve({ status: statusCode, body: data });
        return res;
      }
    };

    ocrRouter(req, res, (err) => {
      if (err) {
        resolve({ status: 500, body: { error: err.message } });
      } else {
        resolve({ status: 404, body: { error: 'Not Found' } });
      }
    });
  });
}

describe('Adversarial Challenge 1: extractJsonObject Resilient JSON Parsing', () => {
  test('1.a: Truncated DeepSeek output with unclosed <think> tag', () => {
    // Input: <think>Reasoning process here... {"studentName": "아로나", "level": 90}
    // When <think> tag is never closed, reasoning was truncated mid-generation.
    const input = '<think>Reasoning process here... {"studentName": "아로나", "level": 90}';
    
    // In ocrService.js:
    // cleaned = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim()
    // Strips from <think> to end of text ($), leaving empty string.
    // Therefore it throws: "응답에서 유효한 JSON 객체('{...}')를 찾을 수 없습니다."
    assert.throws(
      () => extractJsonObject(input),
      /응답에서 유효한 JSON 객체/
    );

    // Conversely, when <think> tag is closed, it correctly extracts the JSON:
    const closedInput = '<think>Reasoning process here...</think> {"studentName": "아로나", "level": 90}';
    const closedResult = extractJsonObject(closedInput);
    assert.equal(closedResult.studentName, '아로나');
    assert.equal(closedResult.level, 90);
  });

  test('1.b: Markdown code fence with messy comments and unquoted keys (3 backticks and 4 backticks)', () => {
    // 3 backticks
    const input3 = '```json\n// leading line comment\n{\n  studentName: "시로코",\n  /* multi\nline\ncomment */\n  level: 90,\n}\n```';
    const res3 = extractJsonObject(input3);
    assert.equal(res3.studentName, '시로코');
    assert.equal(res3.level, 90);

    // 4 backticks (markdown nesting)
    const input4 = '````json\n// leading line comment\n{\n  studentName: "시로코",\n  /* inline comment */\n  level: 90,\n}\n````';
    const res4 = extractJsonObject(input4);
    assert.equal(res4.studentName, '시로코');
    assert.equal(res4.level, 90);

    // Without json tag, single quotes, trailing commas
    const inputAlt = "```\n{\n  studentName: '시로코',\n  level: 90,\n  starGrade: 3,\n}\n```";
    const resAlt = extractJsonObject(inputAlt);
    assert.equal(resAlt.studentName, '시로코');
    assert.equal(resAlt.level, 90);
    assert.equal(resAlt.starGrade, 3);
  });

  test('1.c: Text before and after JSON object', () => {
    const input = 'Here is the extracted data: {"studentName": "호시노"} hope this helps!';
    const result = extractJsonObject(input);
    assert.equal(result.studentName, '호시노');

    // Multi-line text before and after with conversational wrapper
    const multi = `Hello Sensei!\nI parsed the image for you.\n{"studentName": "호시노(수영복)", "level": 90}\nPlease verify!`;
    const multiRes = extractJsonObject(multi);
    assert.equal(multiRes.studentName, '호시노(수영복)');
    assert.equal(multiRes.level, 90);
  });

  test('1.d: Empty or non-JSON string', () => {
    assert.throws(() => extractJsonObject(''), /응답에서 유효한 JSON 객체/);
    assert.throws(() => extractJsonObject('   \n\t  '), /응답에서 유효한 JSON 객체/);
    assert.throws(() => extractJsonObject('안녕하세요! 오늘은 날씨가 좋습니다.'), /응답에서 유효한 JSON 객체/);
    // Unclosed brace
    assert.throws(() => extractJsonObject('Some text { broken json ['), /응답에서 유효한 JSON 객체/);
    // Closed brace but completely invalid syntax inside
    assert.throws(() => extractJsonObject('Some text { broken invalid json }'), /추출된 JSON 최상위 구조를 해석할 수 없습니다/);
    assert.throws(() => extractJsonObject(null), /응답 텍스트가 유효하지 않습니다/);
    assert.throws(() => extractJsonObject(undefined), /응답 텍스트가 유효하지 않습니다/);
    assert.throws(() => extractJsonObject(12345), /응답 텍스트가 유효하지 않습니다/);
  });
});

describe('Adversarial Challenge 2: normalizeOcrData Normalization Boundaries', () => {
  test('2.a: Out-of-bounds level, starGrade, skills, weapon, equipment', () => {
    // Upper bounds
    const high = {
      studentName: '아로나',
      level: 999, // clamp to 90
      starGrade: 99, // clamp to 5
      bondRank: 9999, // clamp to 100
      skills: {
        ex: 10, // clamp to 5
        normal: 99, // clamp to 10
        passive: 50, // clamp to 10
        sub: 100 // clamp to 10
      },
      weapon: {
        starGrade: 9, // clamp to 4
        level: 150 // clamp to 60
      },
      favoriteItem: {
        tier: 5 // clamp to 2
      },
      stats: {
        hp: { val: 100000, potential: 99 } // potential clamp to 25
      }
    };
    const normHigh = normalizeOcrData(high);

    assert.equal(normHigh.level, 90, 'level capped at 90');
    assert.equal(normHigh.starGrade, 5, 'starGrade capped at 5');
    assert.equal(normHigh.bondRank, 100, 'bondRank capped at 100');
    assert.equal(normHigh.skills.ex, 5, 'EX skill capped at 5');
    assert.equal(normHigh.skills.normal, 10, 'normal skill capped at 10');
    assert.equal(normHigh.skills.passive, 10, 'passive skill capped at 10');
    assert.equal(normHigh.skills.sub, 10, 'sub skill capped at 10');
    assert.equal(normHigh.weapon.starGrade, 4, 'weapon star capped at 4');
    assert.equal(normHigh.weapon.level, 60, 'weapon level capped at 60');
    assert.equal(normHigh.favoriteItem.tier, 2, 'favoriteItem tier capped at 2');
    assert.equal(normHigh.stats.hp.releaseLevel, 25, 'stats potential capped at 25');

    // Lower bounds & negative inputs
    const low = {
      studentName: '프라나',
      level: -10, // negative -> fallback 1
      starGrade: -1, // negative -> fallback 3
      bondRank: -5, // negative -> null
      skills: {
        ex: -5, // clamped to 1
        normal: 0, // clamped to 1
        passive: -1, // clamped to 1
        sub: -99 // clamped to 1
      },
      stats: {
        hp: { val: -50, potential: -10 } // potential <= 0 -> null
      }
    };
    const normLow = normalizeOcrData(low);

    assert.equal(normLow.level, 1, 'level fallback to 1');
    assert.equal(normLow.starGrade, 3, 'starGrade fallback to 3');
    assert.equal(normLow.bondRank, null, 'negative bondRank is null');
    assert.equal(normLow.skills.ex, 1, 'EX skill clamped to 1');
    assert.equal(normLow.skills.normal, 1, 'normal skill clamped to 1');
    assert.equal(normLow.skills.passive, 1, 'passive skill clamped to 1');
    assert.equal(normLow.skills.sub, 1, 'sub skill clamped to 1');
    assert.equal(normLow.stats.hp.releaseLevel, null, 'negative potential normalized to null');
  });

  test('2.b: Null / undefined / invalid type inputs to normalizeOcrData', () => {
    assert.throws(() => normalizeOcrData(null), /정규화할 원본 데이터가 올바른 객체가 아닙니다/);
    assert.throws(() => normalizeOcrData(undefined), /정규화할 원본 데이터가 올바른 객체가 아닙니다/);
    assert.throws(() => normalizeOcrData('not an object'), /정규화할 원본 데이터가 올바른 객체가 아닙니다/);
    assert.throws(() => normalizeOcrData(42), /정규화할 원본 데이터가 올바른 객체가 아닙니다/);

    // Empty object must yield complete valid schema with default fallbacks
    const empty = normalizeOcrData({});
    assert.equal(empty.studentName, '');
    assert.equal(empty.level, 1);
    assert.equal(empty.starGrade, 3);
    assert.equal(empty.bondRank, null);
    assert.deepEqual(empty.skills, { ex: 1, normal: 1, passive: 1, sub: 1 });
    assert.equal(empty.equipments.length, 3);
    assert.equal(empty.equipments[0].unequipped, true);
    assert.equal(empty.favoriteItem.unequipped, true);
    assert.equal(empty.weapon.unequipped, true);
    assert.deepEqual(empty.equipment, { slot1: null, slot2: null, slot3: null });
    assert.equal(empty.uniqueWeapon, null);
    assert.equal(empty.bondLevel, null);
  });
});

describe('Adversarial Challenge 3: Route Input Validation (POST /api/ocr)', () => {
  test('3.a: Missing image property in request body', async () => {
    // Empty body
    const res1 = await simulateRoute({ method: 'POST', url: '/', body: {} });
    assert.equal(res1.status, 400);
    assert.equal(res1.body.success, false);
    assert.equal(res1.body.error, '이미지 데이터가 필요합니다.');

    // null body
    const res2 = await simulateRoute({ method: 'POST', url: '/', body: null });
    assert.equal(res2.status, 400);
    assert.equal(res2.body.success, false);
    assert.equal(res2.body.error, '이미지 데이터가 필요합니다.');

    // image is not a string
    const res3 = await simulateRoute({ method: 'POST', url: '/', body: { image: 12345 } });
    assert.equal(res3.status, 400);
    assert.equal(res3.body.success, false);
    assert.equal(res3.body.error, '이미지 데이터가 필요합니다.');

    // image is empty string
    const res4 = await simulateRoute({ method: 'POST', url: '/', body: { image: '' } });
    assert.equal(res4.status, 400);
    assert.equal(res4.body.success, false);
    assert.equal(res4.body.error, '이미지 데이터가 필요합니다.');
  });

  test('3.b: Corrupt base64 string without data:image/ header', async () => {
    // Raw base64 without data:image/ prefix
    const res1 = await simulateRoute({
      method: 'POST',
      url: '/',
      body: { image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }
    });
    assert.equal(res1.status, 400);
    assert.equal(res1.body.success, false);
    assert.equal(res1.body.error, '이미지 형식이 올바르지 않습니다. (data:image/... 형식이 필요합니다)');

    // HTTP URL
    const res2 = await simulateRoute({
      method: 'POST',
      url: '/',
      body: { image: 'https://example.com/student.png' }
    });
    assert.equal(res2.status, 400);
    assert.equal(res2.body.success, false);
    assert.equal(res2.body.error, '이미지 형식이 올바르지 않습니다. (data:image/... 형식이 필요합니다)');

    // Text prefix
    const res3 = await simulateRoute({
      method: 'POST',
      url: '/',
      body: { image: 'data:text/plain;base64,SGVsbG8=' }
    });
    assert.equal(res3.status, 400);
    assert.equal(res3.body.success, false);
    assert.equal(res3.body.error, '이미지 형식이 올바르지 않습니다. (data:image/... 형식이 필요합니다)');
  });

  test('3.c: GET /api/ocr/status metrics endpoint', async () => {
    const res = await simulateRoute({ method: 'GET', url: '/status' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.model, DEFAULT_MODEL);
    assert.equal(typeof res.body.metrics.queueLength, 'number');
    assert.equal(typeof res.body.metrics.recentRpm, 'number');
    assert.equal(typeof res.body.metrics.activeCount, 'number');
  });

  test('3.d: req.close (body stream EOF) does NOT prematurely abort the OCR request with 499, whereas res.close (client disconnect) DOES abort with 499', async () => {
    const reqListeners = {};
    const resListeners = {};
    let statusCode = 200;
    let headersSent = false;
    let ended = false;

    const req = {
      method: 'POST',
      url: '/',
      body: { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
      on: (event, handler) => {
        reqListeners[event] = reqListeners[event] || [];
        reqListeners[event].push(handler);
      },
      removeListener: (event, handler) => {
        if (reqListeners[event]) {
          reqListeners[event] = reqListeners[event].filter((h) => h !== handler);
        }
      }
    };

    let resolvedResponse = null;
    const responsePromise = new Promise((resolve) => {
      resolvedResponse = resolve;
    });

    const res = {
      get statusCode() { return statusCode; },
      set statusCode(code) { statusCode = code; },
      get headersSent() { return headersSent; },
      get writableEnded() { return ended; },
      on: (event, handler) => {
        resListeners[event] = resListeners[event] || [];
        resListeners[event].push(handler);
      },
      removeListener: (event, handler) => {
        if (resListeners[event]) {
          resListeners[event] = resListeners[event].filter((h) => h !== handler);
        }
      },
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        headersSent = true;
        ended = true;
        resolvedResponse({ status: statusCode, body: data });
        return res;
      }
    };

    ocrRouter(req, res, () => {});

    // 1) Simulate Node 22+ body-parser finishing reading request stream -> emits req 'close'
    assert.equal(reqListeners['close'] || [].length, 0, 'Must NOT attach abort listener to req.on("close")');

    // 2) Simulate actual client disconnect -> emits res 'close' before response is ended
    assert.ok(resListeners['close'] && resListeners['close'].length === 1, 'Must attach disconnect listener to res.on("close")');
    resListeners['close'][0]();

    const finalRes = await responsePromise;
    assert.equal(finalRes.status, 499, 'Client socket close before writableEnded must return 499');
  });
});
