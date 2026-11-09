/**
 * Comprehensive Unit Test Suite for OCR Queue, OCR Service, and Express Route
 *
 * Verifies:
 * 1. FIFO execution sequence ordering
 * 2. Gate 1: Inter-dispatch interval pacing
 * 3. Gate 2: Rolling sliding window limit
 * 4. Client abort / cancellation while waiting in queue
 * 5. Client abort in-flight
 * 6. Backpressure queue overflow (maxQueueLength -> QUEUE_FULL)
 * 7. Queue wait timeout eviction (queueTimeoutMs -> QUEUE_TIMEOUT)
 * 8. Queue drain functionality
 * 9. JSON extraction: <think> tag stripping, markdown fence removal, trailing commas
 * 10. Data normalization schema conformity and edge-case boundaries
 * 11. Express route validation (POST /api/ocr and GET /api/ocr/status)
 */

const test = require('node:test');
const assert = require('node:assert');

const {
  OcrFifoQueue,
  QueueFullError,
  QueueTimeoutError
} = require('../services/ocrQueue');

const {
  extractJsonObject,
  normalizeOcrData,
  toOptionalInt,
  toSkillLevel,
  DEFAULT_MODEL
} = require('../services/ocrService');

// ---------------------------------------------------------------------------
// 1. FIFO Execution Sequence Ordering
// ---------------------------------------------------------------------------
test('1. [FIFO Ordering] Tasks execute strictly in the order they were enqueued', async () => {
  const queue = new OcrFifoQueue({ minIntervalMs: 5 });
  const executedOrder = [];

  const promises = [1, 2, 3, 4, 5].map((num) =>
    queue.enqueue(async () => {
      executedOrder.push(num);
      return num;
    })
  );

  const results = await Promise.all(promises);

  assert.deepStrictEqual(results, [1, 2, 3, 4, 5], 'Resolved values must match input sequence');
  assert.deepStrictEqual(executedOrder, [1, 2, 3, 4, 5], 'Execution order must be strictly FIFO');
  assert.strictEqual(queue.getMetrics().totalProcessed, 5);
  await queue.drain();
});

// ---------------------------------------------------------------------------
// 2. Gate 1: Inter-dispatch Interval Pacing
// ---------------------------------------------------------------------------
test('2. [Rate Pacing] Inter-dispatch spacing adheres to minIntervalMs', async () => {
  const minInterval = 60; // 60ms pacing
  const queue = new OcrFifoQueue({ minIntervalMs: minInterval });
  const dispatchTimes = [];

  const promises = [1, 2, 3].map(() =>
    queue.enqueue(async () => {
      dispatchTimes.push(Date.now());
      await new Promise(r => setTimeout(r, 10));
    })
  );

  await Promise.all(promises);

  assert.strictEqual(dispatchTimes.length, 3);
  for (let i = 1; i < dispatchTimes.length; i++) {
    const delta = dispatchTimes[i] - dispatchTimes[i - 1];
    // Allow 5ms jitter for Node timer tolerance
    assert.ok(
      delta >= minInterval - 5,
      `Interval between task ${i} and ${i + 1} was ${delta}ms, expected >= ${minInterval - 5}ms`
    );
  }
  await queue.drain();
});

// ---------------------------------------------------------------------------
// 3. Gate 2: Rolling Sliding Window Limit
// ---------------------------------------------------------------------------
test('3. [Sliding Window] Dispatches are throttled when maxPerMinute is reached', async () => {
  const windowMs = 250;
  const maxPerMinute = 2; // Allow only 2 dispatches in window
  const queue = new OcrFifoQueue({
    minIntervalMs: 10,
    maxPerMinute,
    windowMs
  });

  const timestamps = [];
  const promises = [1, 2, 3].map(() =>
    queue.enqueue(async () => {
      timestamps.push(Date.now());
    })
  );

  await Promise.all(promises);

  assert.strictEqual(timestamps.length, 3);
  // 3rd task must have waited until the 1st task fell out of the sliding window
  const waitBetweenFirstAndThird = timestamps[2] - timestamps[0];
  assert.ok(
    waitBetweenFirstAndThird >= windowMs - 10,
    `Third task waited ${waitBetweenFirstAndThird}ms, expected >= ${windowMs - 10}ms`
  );
  await queue.drain();
});

// ---------------------------------------------------------------------------
// 4. Client Cancellation While Waiting in Queue
// ---------------------------------------------------------------------------
test('4. [Abort In Queue] Aborting while waiting removes task and never calls taskFn', async () => {
  const queue = new OcrFifoQueue({ minIntervalMs: 10 });
  const controller = new AbortController();
  let task2Called = false;

  // Task 1: blocks queue for 120ms
  const p1 = queue.enqueue(async () => {
    await new Promise(r => setTimeout(r, 120));
    return 'task1-done';
  });

  // Task 2: queued behind Task 1
  const p2 = queue.enqueue(
    async () => {
      task2Called = true;
      return 'task2-done';
    },
    { signal: controller.signal }
  );

  // Attach rejection listener immediately so Node doesn't trigger unhandledRejection
  const p2Rejection = assert.rejects(
    p2,
    (err) => {
      assert.strictEqual(err.name, 'AbortError');
      return true;
    },
    'Task 2 must reject with AbortError'
  );

  // Abort Task 2 after 30ms while Task 1 is still running
  setTimeout(() => {
    controller.abort();
  }, 30);

  const res1 = await p1;
  assert.strictEqual(res1, 'task1-done');
  await p2Rejection;

  assert.strictEqual(task2Called, false, 'Task 2 taskFn must never have been called');
  assert.strictEqual(queue.getMetrics().queueLength, 0, 'Queue must be empty');
  assert.strictEqual(queue.getMetrics().totalAborted, 1, 'Total aborted count must be 1');
  await queue.drain();
});

// ---------------------------------------------------------------------------
// 5. Client Abort In-Flight
// ---------------------------------------------------------------------------
test('5. [Abort In-Flight] Active task receives abort signal and propagates error', async () => {
  const queue = new OcrFifoQueue({ minIntervalMs: 5 });
  const controller = new AbortController();
  let signalReceivedAborted = false;

  const p = queue.enqueue(
    async (taskSignal) => {
      // Simulate task listening to signal
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve('completed'), 200);
        taskSignal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            signalReceivedAborted = true;
            const err = new Error('Task aborted');
            err.name = 'AbortError';
            reject(err);
          },
          { once: true }
        );
      });
    },
    { signal: controller.signal }
  );

  // Abort shortly after task starts
  setTimeout(() => {
    controller.abort();
  }, 40);

  await assert.rejects(
    p,
    (err) => err.name === 'AbortError',
    'In-flight task must reject with AbortError'
  );

  assert.strictEqual(signalReceivedAborted, true, 'Task signal listener must have fired');
  assert.strictEqual(queue.getMetrics().totalAborted, 1);
  await queue.drain();
});

// ---------------------------------------------------------------------------
// 6. Backpressure: Queue Overflow (maxQueueLength)
// ---------------------------------------------------------------------------
test('6. [Backpressure] Rejects with QUEUE_FULL error when queue depth exceeds maxQueueLength', async () => {
  const queue = new OcrFifoQueue({
    maxQueueLength: 2,
    minIntervalMs: 5
  });

  // Task 1: active (running)
  const pActive = queue.enqueue(async () => {
    await new Promise(r => setTimeout(r, 150));
    return 'active';
  });

  // Task 2 & 3: waiting in queue (now length is 2)
  const pWait1 = queue.enqueue(async () => 'wait1');
  const pWait2 = queue.enqueue(async () => 'wait2');

  assert.strictEqual(queue.getMetrics().queueLength, 2);

  // Task 4: exceeds maxQueueLength (2) -> must reject immediately
  await assert.rejects(
    queue.enqueue(async () => 'overflow'),
    (err) => {
      assert.ok(err instanceof QueueFullError);
      assert.strictEqual(err.code, 'QUEUE_FULL');
      assert.strictEqual(err.status, 429);
      return true;
    },
    'Should reject with QueueFullError'
  );

  await Promise.all([pActive, pWait1, pWait2]);
  await queue.drain();
});

// ---------------------------------------------------------------------------
// 7. Queue Wait Timeout (queueTimeoutMs)
// ---------------------------------------------------------------------------
test('7. [Queue Timeout] Waiting task is evicted and rejects with QUEUE_TIMEOUT', async () => {
  const queue = new OcrFifoQueue({
    queueTimeoutMs: 80,
    minIntervalMs: 5
  });

  // Task 1: blocks the queue for 200ms
  const p1 = queue.enqueue(async () => {
    await new Promise(r => setTimeout(r, 200));
    return 'p1';
  });

  // Task 2: waits in queue with 80ms timeout
  const p2 = queue.enqueue(async () => 'p2');

  const startTime = Date.now();
  await assert.rejects(
    p2,
    (err) => {
      const elapsed = Date.now() - startTime;
      assert.ok(err instanceof QueueTimeoutError);
      assert.strictEqual(err.code, 'QUEUE_TIMEOUT');
      assert.strictEqual(err.status, 504);
      assert.ok(elapsed >= 70 && elapsed <= 160, `Elapsed ${elapsed}ms around 80ms timeout`);
      return true;
    },
    'Task 2 must reject with QueueTimeoutError'
  );

  await p1;
  assert.strictEqual(queue.getMetrics().queueLength, 0);
  assert.strictEqual(queue.getMetrics().totalFailed, 1);
  await queue.drain();
});

// ---------------------------------------------------------------------------
// 8. Queue Drain Functionality
// ---------------------------------------------------------------------------
test('8. [Queue Drain] drain({ cancelPending: true }) cleanly cancels waiting tasks', async () => {
  const queue = new OcrFifoQueue({ minIntervalMs: 10 });

  const p1 = queue.enqueue(async () => {
    await new Promise(r => setTimeout(r, 60));
    return 'done1';
  });

  const p2 = queue.enqueue(async () => 'done2');
  const p3 = queue.enqueue(async () => 'done3');

  const p2Rejection = assert.rejects(p2, (err) => err.name === 'AbortError');
  const p3Rejection = assert.rejects(p3, (err) => err.name === 'AbortError');

  // Cancel remaining while p1 is active
  await queue.drain({ cancelPending: true });

  const res1 = await p1;
  assert.strictEqual(res1, 'done1');

  await p2Rejection;
  await p3Rejection;
  assert.strictEqual(queue.getMetrics().queueLength, 0);
  assert.strictEqual(queue.getMetrics().activeCount, 0);
});

// ---------------------------------------------------------------------------
// 9. JSON Extraction: <think> Tag Stripping, Markdown Fences, Sanitization
// ---------------------------------------------------------------------------
test('9. [JSON Extraction] Strips <think> tags, markdown fences, and parses JSON', () => {
  // Test case 1: Reasoning model output with <think> tag
  const rawWithThink = `
<think>
The student in the screenshot is Aru.
Star grade: 5 stars visible.
Level: 90.
</think>
\`\`\`json
{
  "studentName": "아루",
  "level": 90,
  "starGrade": 5,
  "bondRank": 20,
  "skills": { "ex": 5, "normal": 10, "passive": 10, "sub": 10 },
  "equipments": [
    { "slot": 1, "tier": 8, "level": 60 },
    { "slot": 2, "tier": 8, "level": 60 },
    { "slot": 3, "tier": 8, "level": 60 }
  ],
  "favoriteItem": { "tier": 2 },
  "weapon": { "starGrade": 3, "level": 50 },
  "stats": {
    "hp": { "value": 52140, "releaseLevel": 25 },
    "atk": { "value": 4890, "releaseLevel": 25 },
    "def": { "value": 810, "releaseLevel": 0 },
    "heal": { "value": 1420, "releaseLevel": null }
  }
}
\`\`\`
`;
  const parsed1 = extractJsonObject(rawWithThink);
  assert.strictEqual(parsed1.studentName, '아루');
  assert.strictEqual(parsed1.level, 90);
  assert.strictEqual(parsed1.starGrade, 5);

  // Test case 2: Unclosed <think> tag (truncated generation)
  const unclosedThink = `<think>Analyzing student name...{"studentName": "히나"}`;
  // Should strip unclosed think or throw if no JSON remains
  assert.throws(() => extractJsonObject(unclosedThink));

  // Test case 3: JSON with trailing commas and conversational preamble
  const trailingCommas = `Here is the extracted Blue Archive data:
{
  "studentName": "무츠키",
  "level": 87,
  "starGrade": 4,
}
Hope this helps!`;
  const parsed3 = extractJsonObject(trailingCommas);
  assert.strictEqual(parsed3.studentName, '무츠키');
  assert.strictEqual(parsed3.level, 87);
  assert.strictEqual(parsed3.starGrade, 4);
});

// ---------------------------------------------------------------------------
// 10. Data Normalization Schema Conformity & Boundary Handlers
// ---------------------------------------------------------------------------
test('10. [Data Normalization] normalizeOcrData produces standard schema with boundaries', () => {
  const raw = {
    name: '시로코(수영복)',
    level: 'Lv.95', // exceeds 90 -> capped to 90
    stars: 6, // exceeds 5 -> capped to 5
    bond: 150, // exceeds 100 -> capped to 100
    skills: {
      ex: 'MAX', // 5
      normal: 'M', // 10
      passive: 'Lv.7', // 7
      sub: 1 // 1
    },
    equipments: [
      { slot: 1, tier: 'T9', level: 65 },
      { slot: 2, unequipped: true },
      { slot: 3, tier: null, level: null }
    ],
    favoriteItem: { tier: 3 }, // capped to 2
    weapon: { starGrade: 5, level: 70 }, // star capped to 4, level capped to 60
    stats: {
      hp: { val: 40000, potential: 30 }, // potential capped to 25
      atk: { val: 3500, potential: -1 }, // negative -> null
      def: 600,
      heal: null
    }
  };

  const normalized = normalizeOcrData(raw);

  assert.strictEqual(normalized.studentName, '시로코(수영복)');
  assert.strictEqual(normalized.level, 90, 'Level capped at 90');
  assert.strictEqual(normalized.starGrade, 5, 'Star grade capped at 5');
  assert.strictEqual(normalized.bondRank, 100, 'Bond rank capped at 100');

  // Skills
  assert.deepStrictEqual(normalized.skills, {
    ex: 5,
    normal: 10,
    passive: 7,
    sub: 1
  });

  // Equipments
  assert.strictEqual(normalized.equipments.length, 3);
  assert.strictEqual(normalized.equipments[0].unequipped, false);
  assert.strictEqual(normalized.equipments[0].tier, 9);
  assert.strictEqual(normalized.equipments[0].level, 65);
  assert.strictEqual(normalized.equipments[1].unequipped, true);
  assert.strictEqual(normalized.equipments[2].unequipped, true);

  // Favorite Item
  assert.strictEqual(normalized.favoriteItem.unequipped, false);
  assert.strictEqual(normalized.favoriteItem.tier, 2, 'Tier capped at 2');

  // Weapon
  assert.strictEqual(normalized.weapon.unequipped, false);
  assert.strictEqual(normalized.weapon.starGrade, 4, 'Weapon star capped at 4');
  assert.strictEqual(normalized.weapon.level, 60, 'Weapon level capped at 60');

  // Stats
  assert.strictEqual(normalized.stats.hp.value, 40000);
  assert.strictEqual(normalized.stats.hp.releaseLevel, 25, 'Potential capped at 25');
  assert.strictEqual(normalized.stats.atk.releaseLevel, null, 'Negative potential normalized to null');
  assert.strictEqual(normalized.stats.def.value, 600);
  assert.strictEqual(normalized.stats.heal.value, 0);

  // Compatibility aliases
  assert.deepStrictEqual(normalized.equipment, { slot1: 9, slot2: null, slot3: null });
  assert.deepStrictEqual(normalized.uniqueWeapon, { star: 4, level: 60 });
});

// ---------------------------------------------------------------------------
// 11. Helper Function Unit Tests (toOptionalInt, toSkillLevel)
// ---------------------------------------------------------------------------
test('11. [Helper Unit Tests] toOptionalInt and toSkillLevel edge cases', () => {
  assert.strictEqual(toOptionalInt('Lv.85'), 85);
  assert.strictEqual(toOptionalInt('123,456'), 123456);
  assert.strictEqual(toOptionalInt('-'), null);
  assert.strictEqual(toOptionalInt('null'), null);
  assert.strictEqual(toOptionalInt(undefined), null);
  assert.strictEqual(toOptionalInt(true), null);

  assert.strictEqual(toSkillLevel('MAX', true), 5);
  assert.strictEqual(toSkillLevel('MAX', false), 10);
  assert.strictEqual(toSkillLevel(null, true), 1);
  assert.strictEqual(toSkillLevel(12, true), 5); // clamped to 5
  assert.strictEqual(toSkillLevel(12, false), 10); // clamped to 10
});

// ---------------------------------------------------------------------------
// 12. Express Integration: Route Validation & Status Endpoint
// ---------------------------------------------------------------------------
test('12. [Express Route] /api/ocr and /api/ocr/status handling', async () => {
  const ocrRouter = require('../routes/ocr');

  function simulateRoute({ method = 'GET', url = '/', body = {} } = {}) {
    return new Promise((resolve) => {
      let statusCode = 200;
      let headersSent = false;
      const listeners = {};

      const req = {
        method,
        url,
        body,
        on: (event, handler) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        },
        removeListener: (event, handler) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter(h => h !== handler);
          }
        }
      };

      const res = {
        get statusCode() { return statusCode; },
        set statusCode(code) { statusCode = code; },
        get headersSent() { return headersSent; },
        on: (event, handler) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        },
        removeListener: (event, handler) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter(h => h !== handler);
          }
        },
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          headersSent = true;
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

  // 1) Validation: missing image property
  const resBad1 = await simulateRoute({
    method: 'POST',
    url: '/',
    body: {}
  });
  assert.strictEqual(resBad1.status, 400);
  assert.strictEqual(resBad1.body.success, false);
  assert.ok(resBad1.body.error.includes('이미지 데이터가 필요합니다'));

  // 2) Validation: not a data:image/... url
  const resBad2 = await simulateRoute({
    method: 'POST',
    url: '/',
    body: { image: 'https://example.com/image.png' }
  });
  assert.strictEqual(resBad2.status, 400);
  assert.strictEqual(resBad2.body.success, false);
  assert.ok(resBad2.body.error.includes('data:image/'));

  // 3) Status endpoint
  const resStatus = await simulateRoute({
    method: 'GET',
    url: '/status'
  });
  assert.strictEqual(resStatus.status, 200);
  assert.strictEqual(resStatus.body.success, true);
  assert.strictEqual(resStatus.body.model, DEFAULT_MODEL);
  assert.ok(typeof resStatus.body.metrics.queueLength === 'number');
  assert.ok(typeof resStatus.body.metrics.recentRpm === 'number');
});
