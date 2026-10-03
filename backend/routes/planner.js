const express = require('express');
const router = express.Router();
const { optionalAuth, requireAuth } = require('../middleware/auth');
const plannerService = require('../services/plannerService');

router.get('/', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.json([]);
    const plans = await plannerService.getPlans(req.user.id);
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '플랜 목록을 불러오지 못했습니다.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const plan = await plannerService.createPlan(req.user.id, req.body.studentId);
    res.json(plan);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to create plan' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const updated = await plannerService.updatePlan(req.user.id, req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to update plan' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await plannerService.deletePlan(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to delete plan' });
  }
});

router.get('/calculate/:id', requireAuth, async (req, res) => {
  try {
    const result = await plannerService.calculatePlan(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to calculate' });
  }
});

router.post('/calculate/dynamic', async (req, res) => {
  try {
    const result = await plannerService.calculateDynamicPlan(req.body.plan);
    res.json(result);
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to calculate dynamic' });
  }
});

router.get('/equipment-drops', async (req, res) => {
  try {
    const dropData = plannerService.getEquipmentDrops();
    res.json(dropData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get equipment drops' });
  }
});

module.exports = router;
