/**
 * OCR Router - Express 5
 *
 * Exposes:
 * POST /api/ocr - Enqueues Blue Archive student OCR recognition task
 * GET  /api/ocr/status - Returns current queue metrics and model info
 */

const express = require('express');
const router = express.Router();
const { enqueueOcr, DEFAULT_MODEL } = require('../services/ocrService');
const { ocrQueue, QueueFullError, QueueTimeoutError } = require('../services/ocrQueue');

router.post('/', async (req, res) => {
  const clientController = new AbortController();

  const onClientClose = () => {
    if (!res.writableEnded) {
      clientController.abort();
    }
  };
  req.on('close', onClientClose);

  try {
    const { image } = req.body || {};

    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        success: false,
        error: '이미지 데이터가 필요합니다.'
      });
    }

    const trimmed = image.trim();
    if (!trimmed.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        error: '이미지 형식이 올바르지 않습니다. (data:image/... 형식이 필요합니다)'
      });
    }

    const result = await enqueueOcr(trimmed, { signal: clientController.signal });
    return res.status(200).json(result);
  } catch (err) {
    if (clientController.signal.aborted || err.name === 'AbortError' || err.code === 'ABORT_ERR') {
      if (!res.headersSent) {
        return res.status(499).json({
          success: false,
          error: '클라이언트에 의해 요청이 취소되었습니다.'
        });
      }
      return;
    }

    if (err instanceof QueueFullError || err.code === 'QUEUE_FULL') {
      return res.status(429).json({
        success: false,
        error: err.message || '대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.',
        code: 'QUEUE_FULL'
      });
    }

    if (err instanceof QueueTimeoutError || err.code === 'QUEUE_TIMEOUT') {
      return res.status(504).json({
        success: false,
        error: err.message || '대기 시간이 초과되었습니다.',
        code: 'QUEUE_TIMEOUT'
      });
    }

    if (err.status === 401 || err.statusCode === 401) {
      return res.status(500).json({
        success: false,
        error: '서버 OCR 설정 오류: NVIDIA API Key가 유효하지 않습니다.'
      });
    }

    if (err.status === 429 || err.statusCode === 429) {
      return res.status(502).json({
        success: false,
        error: '상위 AI 서비스의 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
      });
    }

    const status = err.status || err.statusCode || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      error: err.message || 'OCR 처리 도중 오류가 발생했습니다.'
    });
  } finally {
    req.removeListener('close', onClientClose);
  }
});

router.get('/status', (req, res) => {
  res.json({
    success: true,
    model: DEFAULT_MODEL,
    metrics: ocrQueue.getMetrics()
  });
});

module.exports = router;
