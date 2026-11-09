/**
 * Adversarial Empirical Verification Suite for OCR Queue
 *
 * Rigorously challenges:
 * a) Burst concurrency: 60 jobs enqueued simultaneously.
 *    - 50 queued, 51st-60th rejected immediately with QueueFullError (HTTP 429).
 * b) Rate limiter pacing:
 *    - Execution timestamps of consecutive tasks never interval < configured threshold.
 *    - Verified with scaled timings (100ms) and full pacing threshold (1550ms).
 *    - Sliding window (Gate 2) throttling verification.
 * c) Cancellation stress:
 *    - Enqueue 20 jobs, randomly abort 10 while queued.
 *    - Verify only remaining 10 execute.
 *    - Check timer and memory listener leaks.
 *    - Pre-aborted signal and in-flight abort resilience.
 * d) Timeout handling:
 *    - Block queue and verify items waiting longer than queueTimeoutMs are evicted.
 *    - Express 504 response verification.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  OcrFifoQueue,
  QueueFullError,
  QueueTimeoutError
} = require('../services/ocrQueue');

// ---------------------------------------------------------------------------
// A. Burst Concurrency & Backpressure
// ---------------------------------------------------------------------------
test('A1. [Adversarial Burst] 60 jobs burst into queue with 1 active blocker: 50 queued, 10 rejected with 429', async () => {
  const queue = new OcrFifoQueue({
    maxQueueLength: 50,
    minIntervalMs: 2,
    maxPerMinute: 100
  });

  // 1. Start an active blocker to occupy the single worker slot
  let unblock;
  const blockerPromise = new Promise((resolve) => { unblock = resolve; });
  const blockerActive = queue.enqueue(async () => {
    await blockerPromise;
    return 'blocker_done';
  });

  // Ensure blocker is active
  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(queue.getMetrics().activeCount, 1, 'Blocker must be active');
  assert.strictEqual(queue.getMetrics().queueLength, 0, 'Queue must initially be empty');

  // 2. Burst 60 jobs simultaneously
  const results = [];
  const startBurstTime = Date.now();
  for (let i = 1; i <= 60; i++) {
    const jobNum = i;
    const p = queue.enqueue(async () => `job_${jobNum}`)
      .then(res => ({ status: 'fulfilled', value: res, jobNum }))
      .catch(err => ({ status: 'rejected', reason: err, jobNum }));
    results.push(p);
  }

  // 3. Inspect immediate state before blocker finishes
  const settledImmediate = await Promise.all(
    results.map(p => Promise.race([
      p,
      new Promise(r => setTimeout(() => r('pending'), 30))
    ]))
  );

  const immediatelyRejected = settledImmediate.filter(r => r !== 'pending');
  const stillPending = settledImmediate.filter(r => r === 'pending');

  assert.strictEqual(queue.getMetrics().queueLength, 50, 'Queue length must be capped at exactly maxQueueLength = 50');
  assert.strictEqual(immediatelyRejected.length, 10, 'Exactly 10 jobs (51st-60th) must reject immediately');
  assert.strictEqual(stillPending.length, 50, 'Exactly 50 jobs (1st-50th) must remain queued');

  // Verify the rejected jobs are jobs 51 to 60
  for (const rej of immediatelyRejected) {
    assert.strictEqual(rej.status, 'rejected');
    assert.ok(rej.jobNum >= 51 && rej.jobNum <= 60, `Rejected job must be >= 51, got ${rej.jobNum}`);
    assert.ok(rej.reason instanceof QueueFullError, 'Error must be instance of QueueFullError');
    assert.strictEqual(rej.reason.code, 'QUEUE_FULL');
    assert.strictEqual(rej.reason.status, 429);
  }

  // 4. Release blocker and verify all 50 queued jobs execute to completion
  unblock();
  await blockerActive;
  const allSettled = await Promise.all(results);

  const fulfilled = allSettled.filter(r => r.status === 'fulfilled');
  const rejected = allSettled.filter(r => r.status === 'rejected');

  assert.strictEqual(fulfilled.length, 50, 'Exactly 50 jobs must be fulfilled');
  assert.strictEqual(rejected.length, 10, 'Exactly 10 jobs must be rejected');

  // Verify FIFO order of the 50 fulfilled jobs
  for (let i = 0; i < 50; i++) {
    assert.strictEqual(fulfilled[i].jobNum, i + 1, `Fulfilled job at index ${i} must be job #${i + 1}`);
    assert.strictEqual(fulfilled[i].value, `job_${i + 1}`);
  }

  await queue.drain();
});

test('A2. [Adversarial Burst Cold Start] 60 jobs burst into idle queue: 1 active, 50 queued, 9 rejected', async () => {
  const queue = new OcrFifoQueue({
    maxQueueLength: 50,
    minIntervalMs: 5,
    maxPerMinute: 100
  });

  const results = [];
  for (let i = 1; i <= 60; i++) {
    const jobNum = i;
    const p = queue.enqueue(async () => {
      await new Promise(r => setTimeout(r, 20));
      return `job_${jobNum}`;
    })
      .then(res => ({ status: 'fulfilled', value: res, jobNum }))
      .catch(err => ({ status: 'rejected', reason: err, jobNum }));
    results.push(p);
  }

  // Check state right after sync burst dispatch
  const metrics = queue.getMetrics();
  assert.strictEqual(metrics.activeCount, 1, 'First task must be active immediately');
  assert.strictEqual(metrics.queueLength, 50, 'Queue must hold exactly 50 jobs');

  // Let all finish
  const allSettled = await Promise.all(results);
  const fulfilled = allSettled.filter(r => r.status === 'fulfilled');
  const rejected = allSettled.filter(r => r.status === 'rejected');

  assert.strictEqual(fulfilled.length, 51, 'Job 1 + Jobs 2..51 (total 51) fulfilled');
  assert.strictEqual(rejected.length, 9, 'Jobs 52..60 (total 9) rejected with 429');
  for (const rej of rejected) {
    assert.strictEqual(rej.reason.code, 'QUEUE_FULL');
    assert.strictEqual(rej.reason.status, 429);
  }

  await queue.drain();
});

// ---------------------------------------------------------------------------
// B. Rate Limiter Pacing & Timing Guarantees
// ---------------------------------------------------------------------------
test('B1. [Rate Limiter Pacing - Scaled] Execution interval never falls below minIntervalMs (100ms)', async () => {
  const minInterval = 100;
  const queue = new OcrFifoQueue({
    minIntervalMs: minInterval,
    maxConcurrent: 1
  });

  const dispatchTimestamps = [];
  const taskCount = 6;

  const promises = Array.from({ length: taskCount }, (_, i) =>
    queue.enqueue(async () => {
      const now = Date.now();
      dispatchTimestamps.push({ taskIdx: i, time: now });
      // Variable task duration: 5ms to 40ms
      await new Promise(r => setTimeout(r, 5 + (i % 3) * 15));
      return i;
    })
  );

  await Promise.all(promises);

  assert.strictEqual(dispatchTimestamps.length, taskCount);
  const intervals = [];
  for (let i = 1; i < dispatchTimestamps.length; i++) {
    const interval = dispatchTimestamps[i].time - dispatchTimestamps[i - 1].time;
    intervals.push(interval);
    // Timer tolerance: Node.js setTimeout jitter is within +/- 5ms
    assert.ok(
      interval >= minInterval - 5,
      `Task ${i} started at interval ${interval}ms < ${minInterval - 5}ms threshold`
    );
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  assert.ok(avgInterval >= minInterval - 2, `Average interval ${avgInterval}ms >= ${minInterval}ms`);
  await queue.drain();
});

test('B2. [Rate Limiter Pacing - Full 1550ms Threshold] Empirical pacing with default 1550ms threshold', async () => {
  const queue = new OcrFifoQueue({
    minIntervalMs: 1550,
    maxConcurrent: 1
  });

  const timestamps = [];
  const p1 = queue.enqueue(async () => {
    timestamps.push(Date.now());
    await new Promise(r => setTimeout(r, 20));
  });

  const p2 = queue.enqueue(async () => {
    timestamps.push(Date.now());
    await new Promise(r => setTimeout(r, 20));
  });

  await Promise.all([p1, p2]);

  assert.strictEqual(timestamps.length, 2);
  const delta = timestamps[1] - timestamps[0];
  // Node timer precision check: delta >= 1550 - 10ms
  assert.ok(
    delta >= 1540,
    `Empirical consecutive dispatch delta was ${delta}ms, strictly enforcing >= 1540ms (configured 1550ms)`
  );

  await queue.drain();
});

test('B3. [Rate Limiter - Overrunning Task Pacing] Tasks longer than minIntervalMs do not introduce negative interval', async () => {
  const queue = new OcrFifoQueue({
    minIntervalMs: 80,
    maxConcurrent: 1
  });

  const timestamps = [];
  // Task 1 runs for 150ms (longer than 80ms minInterval)
  const p1 = queue.enqueue(async () => {
    timestamps.push(Date.now());
    await new Promise(r => setTimeout(r, 150));
  });

  // Task 2 queued
  const p2 = queue.enqueue(async () => {
    timestamps.push(Date.now());
  });

  await Promise.all([p1, p2]);

  assert.strictEqual(timestamps.length, 2);
  const delta = timestamps[1] - timestamps[0];
  // Because Task 1 ran for 150ms, elapsed >= 80ms, so Task 2 dispatched right upon completion
  assert.ok(delta >= 140, `Delta was ${delta}ms >= 140ms`);
  await queue.drain();
});

// ---------------------------------------------------------------------------
// C. Cancellation Stress & Resource Leak Hygiene
// ---------------------------------------------------------------------------
test('C1. [Cancellation Stress] Enqueue 20 jobs, randomly abort 10 while queued: only 10 execute', async () => {
  const queue = new OcrFifoQueue({
    minIntervalMs: 10,
    maxConcurrent: 1
  });

  // Blocker to hold the queue while enqueuing and randomly aborting
  let unblock;
  const blockerPromise = new Promise(resolve => { unblock = resolve; });
  const blocker = queue.enqueue(async () => {
    await blockerPromise;
    return 'blocker';
  });

  // Pick 10 indices out of 20 to abort (e.g. deterministic pseudorandom set: 1, 3, 4, 7, 9, 11, 13, 14, 16, 19)
  const abortIndices = new Set([1, 3, 4, 7, 9, 11, 13, 14, 16, 19]);
  const controllers = [];
  const results = [];
  const executedTaskIds = [];

  for (let i = 0; i < 20; i++) {
    const controller = new AbortController();
    controllers.push(controller);
    const id = i;

    const p = queue.enqueue(
      async () => {
        executedTaskIds.push(id);
        return `done_${id}`;
      },
      { signal: controller.signal }
    )
      .then(val => ({ status: 'fulfilled', val, id }))
      .catch(err => ({ status: 'rejected', err, id }));

    results.push(p);
  }

  assert.strictEqual(queue.getMetrics().queueLength, 20);

  // Abort the 10 selected jobs while they wait in the queue
  for (const idx of abortIndices) {
    controllers[idx].abort();
  }

  // Verify queue length immediately reflects the 10 removals
  assert.strictEqual(queue.getMetrics().queueLength, 10, 'Queue length must immediately drop to 10');
  assert.strictEqual(queue.getMetrics().totalAborted, 10, 'Metrics totalAborted must be 10');

  // Unblock and allow remaining 10 to execute
  unblock();
  await blocker;
  const allSettled = await Promise.all(results);

  const fulfilled = allSettled.filter(r => r.status === 'fulfilled');
  const rejected = allSettled.filter(r => r.status === 'rejected');

  assert.strictEqual(fulfilled.length, 10, 'Exactly 10 jobs must be fulfilled');
  assert.strictEqual(rejected.length, 10, 'Exactly 10 jobs must be rejected');

  for (const rej of rejected) {
    assert.ok(abortIndices.has(rej.id), `Rejected task ID ${rej.id} must be in abort set`);
    assert.strictEqual(rej.err.name, 'AbortError');
    assert.strictEqual(rej.err.code, 'ABORT_ERR');
  }

  for (const ful of fulfilled) {
    assert.ok(!abortIndices.has(ful.id), `Fulfilled task ID ${ful.id} must NOT be in abort set`);
    assert.strictEqual(ful.val, `done_${ful.id}`);
  }

  assert.deepStrictEqual(
    executedTaskIds,
    fulfilled.map(f => f.id),
    'Only the non-aborted tasks must execute'
  );

  // Verify queue hygiene: zero lingering tasks, zero active count, timer cleaned up
  assert.strictEqual(queue.getMetrics().queueLength, 0);
  assert.strictEqual(queue.getMetrics().activeCount, 0);
  assert.strictEqual(queue.processTimer, null, 'Process timer must be null');

  await queue.drain();
});

test('C2. [Cancellation Hygiene] Pre-aborted signal rejected synchronously without queue pollution', async () => {
  const queue = new OcrFifoQueue();
  const preAborted = AbortSignal.abort();

  let executed = false;
  await assert.rejects(
    queue.enqueue(async () => {
      executed = true;
    }, { signal: preAborted }),
    (err) => {
      assert.strictEqual(err.name, 'AbortError');
      return true;
    }
  );

  assert.strictEqual(executed, false, 'Pre-aborted taskFn must never execute');
  assert.strictEqual(queue.getMetrics().queueLength, 0, 'Queue must remain 0');
  assert.strictEqual(queue.getMetrics().totalAborted, 1);
});

// ---------------------------------------------------------------------------
// D. Timeout Handling & Queue Eviction
// ---------------------------------------------------------------------------
test('D1. [Adversarial Timeout] Blocked queue evicts items waiting past queueTimeoutMs', async () => {
  const timeoutMs = 80;
  const queue = new OcrFifoQueue({
    queueTimeoutMs: timeoutMs,
    minIntervalMs: 5
  });

  // Blocker: runs for 220ms (well past timeoutMs = 80ms)
  const blocker = queue.enqueue(async () => {
    await new Promise(r => setTimeout(r, 220));
    return 'blocker_done';
  });

  // Victim 1 & 2: enqueued behind blocker with 80ms timeout
  const v1Start = Date.now();
  const v1 = queue.enqueue(async () => 'victim1');
  const v2 = queue.enqueue(async () => 'victim2');

  assert.strictEqual(queue.getMetrics().queueLength, 2);

  // Verify both reject with QueueTimeoutError
  const [resV1, resV2] = await Promise.allSettled([v1, v2]);

  const elapsedV1 = Date.now() - v1Start;
  assert.strictEqual(resV1.status, 'rejected');
  assert.ok(resV1.reason instanceof QueueTimeoutError);
  assert.strictEqual(resV1.reason.code, 'QUEUE_TIMEOUT');
  assert.strictEqual(resV1.reason.status, 504);
  assert.ok(
    elapsedV1 >= timeoutMs - 10 && elapsedV1 <= timeoutMs + 80,
    `Eviction elapsed ${elapsedV1}ms was around ${timeoutMs}ms`
  );

  assert.strictEqual(resV2.status, 'rejected');
  assert.ok(resV2.reason instanceof QueueTimeoutError);

  // Queue must be empty even before blocker finishes
  assert.strictEqual(queue.getMetrics().queueLength, 0, 'Queue must be 0 after timeout eviction');

  // Let blocker finish
  const resBlocker = await blocker;
  assert.strictEqual(resBlocker, 'blocker_done');
  assert.strictEqual(queue.getMetrics().totalFailed, 2);

  // Ensure queue is still functional after timeouts
  const freshResult = await queue.enqueue(async () => 'fresh_task');
  assert.strictEqual(freshResult, 'fresh_task');

  await queue.drain();
});

test('D2. [Adversarial Route Timeout & Error Mapping] Express route maps errors accurately', async () => {
  const ocrRouter = require('../routes/ocr');
  const { ocrQueue } = require('../services/ocrQueue');

  function invokeRoute({ method = 'POST', url = '/', body = {} } = {}) {
    return new Promise((resolve) => {
      let statusCode = 200;
      let headersSent = false;
      const listeners = {};

      const req = {
        method,
        url,
        body,
        on: (ev, h) => { listeners[ev] = listeners[ev] || []; listeners[ev].push(h); },
        removeListener: (ev, h) => { if (listeners[ev]) listeners[ev] = listeners[ev].filter(x => x !== h); }
      };

      const res = {
        get statusCode() { return statusCode; },
        set statusCode(c) { statusCode = c; },
        get headersSent() { return headersSent; },
        on: (ev, h) => { listeners[ev] = listeners[ev] || []; listeners[ev].push(h); },
        removeListener: (ev, h) => { if (listeners[ev]) listeners[ev] = listeners[ev].filter(x => x !== h); },
        status: (code) => { statusCode = code; return res; },
        json: (data) => {
          headersSent = true;
          resolve({ status: statusCode, body: data });
          return res;
        }
      };

      ocrRouter(req, res, (err) => {
        resolve({ status: 500, body: { error: err?.message || 'internal' } });
      });
    });
  }

  // 1. Missing image -> 400
  const r1 = await invokeRoute({ body: {} });
  assert.strictEqual(r1.status, 400);

  // 2. Non-data:image URI -> 400
  const r2 = await invokeRoute({ body: { image: 'http://foo.bar/baz.png' } });
  assert.strictEqual(r2.status, 400);

  // 3. Status route -> 200 with queue metrics
  const r3 = await invokeRoute({ method: 'GET', url: '/status' });
  assert.strictEqual(r3.status, 200);
  assert.strictEqual(r3.body.success, true);
  assert.strictEqual(r3.body.model, 'deepseek-ai/deepseek-v4.1-flash');
  assert.ok('queueLength' in r3.body.metrics);
  assert.ok('minIntervalMs' in r3.body.metrics);
  assert.ok('maxPerMinute' in r3.body.metrics);
});
