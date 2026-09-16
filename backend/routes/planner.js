const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { calculateRequiredResources } = require('../utils/plannerCalc');
const { getDropData } = require('../utils/dropData');

router.get('/', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.json([]);
    const plans = await prisma.growthPlan.findMany({
      where: { userId: req.user.id },
      include: { student: true }
    });
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '플랜 목록을 불러오지 못했습니다.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.body;
    const existing = await prisma.growthPlan.findFirst({
      where: { userId: req.user.id, studentId: Number(studentId) }
    });
    if (existing) return res.status(400).json({ error: 'Plan already exists' });

    const plan = await prisma.growthPlan.create({
      data: { userId: req.user.id, studentId: Number(studentId) }
    });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const plan = await prisma.growthPlan.findUnique({ where: { id: Number(id) } });
    if (!plan || plan.userId !== req.user.id) return res.status(404).json({ error: 'Plan not found' });

    const updated = await prisma.growthPlan.update({
      where: { id: Number(id) },
      data: {
        currentStar: updates.currentStar, targetStar: updates.targetStar,
        currentLevel: updates.currentLevel, targetLevel: updates.targetLevel,
        currentEx: updates.currentEx, targetEx: updates.targetEx,
        currentBasic: updates.currentBasic, targetBasic: updates.targetBasic,
        currentEnh: updates.currentEnh, targetEnh: updates.targetEnh,
        currentSub: updates.currentSub, targetSub: updates.targetSub,
        currentEquip1: updates.currentEquip1, targetEquip1: updates.targetEquip1,
        currentEquip2: updates.currentEquip2, targetEquip2: updates.targetEquip2,
        currentEquip3: updates.currentEquip3, targetEquip3: updates.targetEquip3,
        currentWeaponStar: updates.currentWeaponStar, targetWeaponStar: updates.targetWeaponStar,
        currentWeaponLevel: updates.currentWeaponLevel, targetWeaponLevel: updates.targetWeaponLevel,
        currentAbility: updates.currentAbility, targetAbility: updates.targetAbility
      }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await prisma.growthPlan.findUnique({ where: { id: Number(id) } });
    if (!plan || plan.userId !== req.user.id) return res.status(404).json({ error: 'Plan not found' });
    await prisma.growthPlan.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

router.get('/calculate/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await prisma.growthPlan.findUnique({
      where: { id: Number(id) },
      include: { student: true }
    });
    if (!plan || plan.userId !== req.user.id) return res.status(404).json({ error: 'Plan not found' });

    const required = calculateRequiredResources(plan);
    res.json({ plan, required });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to calculate' });
  }
});

router.post('/calculate/dynamic', async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: 'Plan data required' });

    const required = calculateRequiredResources(plan);
    res.json({ plan, required });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to calculate dynamic' });
  }
});

router.get('/equipment-drops', async (req, res) => {
  try {
    const dropData = getDropData();
    res.json(dropData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get equipment drops' });
  }
});

module.exports = router;
