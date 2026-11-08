/**
 * In-Memory FIFO Queue with Dual-Gate Rate Limiting (~40 RPM)
 *
 * Implements:
 * 1. FIFO ordering for fair request processing.
 * 2. Gate 1: Minimum spacing interval (default 1550ms) between outbound dispatches.
 * 3. Gate 2: Rolling 60-second sliding window limit (default <= 40 requests/min).
 * 4. Cancellation support (AbortSignal drops queued item or aborts active task).
 * 5. Backpressure rejection when queue depth exceeds maxQueueLength (default 50).
 * 6. Timeout eviction when queued item wait time exceeds queueTimeoutMs (default 90000ms).
 *
 * Zero external dependencies.
 */

class QueueFullError extends Error {
  constructor(message = '대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.') {
    super(message);
    this.name = 'QueueFullError';
    this.code = 'QUEUE_FULL';
    this.status = 429;
  }
}

class QueueTimeoutError extends Error {
  constructor(message = '대기 시간이 초과되었습니다.') {
    super(message);
    this.name = 'QueueTimeoutError';
    this.code = 'QUEUE_TIMEOUT';
    this.status = 504;
  }
}

class OcrFifoQueue {
  constructor(options = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 1550;
    this.maxPerMinute = options.maxPerMinute ?? 40;
    this.windowMs = options.windowMs ?? 60000;
    this.maxQueueLength = options.maxQueueLength ?? 50;
    this.queueTimeoutMs = options.queueTimeoutMs ?? 90000;
    this.maxConcurrent = options.maxConcurrent ?? 1;

    this.queue = [];
    this.activeCount = 0;
    this.lastDispatchTime = 0;
    this.dispatchTimestamps = [];
    this.processTimer = null;
    this.totalProcessed = 0;
    this.totalFailed = 0;
    this.totalAborted = 0;
    this.idCounter = 0;
  }

  /**
   * Enqueue a task to be processed in FIFO order.
   * @param {Function} taskFn - Async function (signal) => Promise<any>
   * @param {Object} [options]
   * @param {AbortSignal} [options.signal] - Client abort signal
   * @returns {Promise<any>}
   */
  enqueue(taskFn, { signal } = {}) {
    if (typeof taskFn !== 'function') {
      return Promise.reject(new TypeError('taskFn must be a function'));
    }

    if (signal?.aborted) {
      const abortErr = new Error('요청이 취소되었습니다.');
      abortErr.name = 'AbortError';
      abortErr.code = 'ABORT_ERR';
      this.totalAborted++;
      return Promise.reject(abortErr);
    }

    if (this.queue.length >= this.maxQueueLength) {
      const fullErr = new QueueFullError('대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.');
      return Promise.reject(fullErr);
    }

    return new Promise((resolve, reject) => {
      const id = ++this.idCounter;

      // Timeout timer for waiting in queue
      const timeoutTimer = setTimeout(() => {
        const idx = this.queue.findIndex(item => item.id === id);
        if (idx !== -1) {
          const [removed] = this.queue.splice(idx, 1);
          if (removed.onAbort && removed.signal) {
            removed.signal.removeEventListener('abort', removed.onAbort);
          }
          const timeoutErr = new QueueTimeoutError('대기 시간이 초과되었습니다.');
          this.totalFailed++;
          reject(timeoutErr);
        }
      }, this.queueTimeoutMs);

      // Abort listener while waiting in queue
      let onAbort = null;
      if (signal) {
        onAbort = () => {
          clearTimeout(timeoutTimer);
          const idx = this.queue.findIndex(item => item.id === id);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            const abortErr = new Error('요청이 취소되었습니다.');
            abortErr.name = 'AbortError';
            abortErr.code = 'ABORT_ERR';
            this.totalAborted++;
            reject(abortErr);
          }
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      this.queue.push({
        id,
        taskFn,
        signal,
        onAbort,
        timeoutTimer,
        resolve,
        reject,
        enqueuedAt: Date.now()
      });

      this._scheduleProcess();
    });
  }

  /**
   * Schedule queue processing respecting rate limit gates.
   * @private
   */
  _scheduleProcess() {
    if (this.processTimer !== null) {
      return;
    }

    if (this.activeCount >= this.maxConcurrent) {
      return;
    }

    // Purge any already aborted items sitting at the head
    while (this.queue.length > 0 && this.queue[0].signal?.aborted) {
      const abortedItem = this.queue.shift();
      clearTimeout(abortedItem.timeoutTimer);
      if (abortedItem.onAbort && abortedItem.signal) {
        abortedItem.signal.removeEventListener('abort', abortedItem.onAbort);
      }
      const abortErr = new Error('요청이 취소되었습니다.');
      abortErr.name = 'AbortError';
      abortErr.code = 'ABORT_ERR';
      this.totalAborted++;
      abortedItem.reject(abortErr);
    }

    if (this.queue.length === 0) {
      return;
    }

    const now = Date.now();
    // Prune timestamps older than rolling window
    this.dispatchTimestamps = this.dispatchTimestamps.filter(t => now - t < this.windowMs);

    let waitTimeMs = 0;

    // Gate 1: Inter-dispatch interval pacing
    if (this.lastDispatchTime > 0) {
      const elapsed = now - this.lastDispatchTime;
      if (elapsed < this.minIntervalMs) {
        waitTimeMs = Math.max(waitTimeMs, this.minIntervalMs - elapsed);
      }
    }

    // Gate 2: Rolling sliding window limit
    if (this.dispatchTimestamps.length >= this.maxPerMinute) {
      const oldest = this.dispatchTimestamps[0];
      const windowRemaining = oldest + this.windowMs - now;
      if (windowRemaining > 0) {
        waitTimeMs = Math.max(waitTimeMs, windowRemaining);
      }
    }

    if (waitTimeMs > 0) {
      this.processTimer = setTimeout(() => {
        this.processTimer = null;
        this._scheduleProcess();
      }, waitTimeMs);
      return;
    }

    // Dispatch next item
    const item = this.queue.shift();
    if (!item) {
      return;
    }

    clearTimeout(item.timeoutTimer);
    if (item.onAbort && item.signal) {
      item.signal.removeEventListener('abort', item.onAbort);
    }

    if (item.signal?.aborted) {
      const abortErr = new Error('요청이 취소되었습니다.');
      abortErr.name = 'AbortError';
      abortErr.code = 'ABORT_ERR';
      this.totalAborted++;
      item.reject(abortErr);
      this._scheduleProcess();
      return;
    }

    const dispatchNow = Date.now();
    this.lastDispatchTime = dispatchNow;
    this.dispatchTimestamps.push(dispatchNow);
    this.activeCount++;

    (async () => {
      try {
        const result = await item.taskFn(item.signal);
        this.totalProcessed++;
        item.resolve(result);
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ABORT_ERR' || item.signal?.aborted) {
          this.totalAborted++;
        } else {
          this.totalFailed++;
        }
        item.reject(err);
      } finally {
        this.activeCount--;
        this._scheduleProcess();
      }
    })();
  }

  /**
   * Return current queue state and metrics.
   * @returns {Object}
   */
  getMetrics() {
    const now = Date.now();
    this.dispatchTimestamps = this.dispatchTimestamps.filter(t => now - t < this.windowMs);
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      recentRpm: this.dispatchTimestamps.length,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      totalAborted: this.totalAborted,
      minIntervalMs: this.minIntervalMs,
      maxPerMinute: this.maxPerMinute,
      maxQueueLength: this.maxQueueLength,
      queueTimeoutMs: this.queueTimeoutMs
    };
  }

  /**
   * Drain queue. Useful for clean shutdowns and tests.
   * @param {Object} [options]
   * @param {boolean} [options.cancelPending=false] - If true, rejects all queued items immediately.
   * @returns {Promise<void>}
   */
  async drain({ cancelPending = false } = {}) {
    if (this.processTimer !== null) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }

    if (cancelPending) {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        clearTimeout(item.timeoutTimer);
        if (item.onAbort && item.signal) {
          item.signal.removeEventListener('abort', item.onAbort);
        }
        const err = new Error('Queue drained');
        err.name = 'AbortError';
        err.code = 'ABORT_ERR';
        this.totalAborted++;
        item.reject(err);
      }
    }

    // Wait for in-flight tasks to finish
    while (this.activeCount > 0 || (!cancelPending && this.queue.length > 0)) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
}

const defaultOcrQueue = new OcrFifoQueue();

module.exports = {
  OcrFifoQueue,
  QueueFullError,
  QueueTimeoutError,
  ocrQueue: defaultOcrQueue
};
