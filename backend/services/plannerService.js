const { prisma } = require('../db');
const { calculateRequiredResources } = require('../utils/plannerCalc');
const { getDropData } = require('../utils/dropData');

const getPlans = async (userId) => {
  return await prisma.growthPlan.findMany({
    where: { userId },
    include: { student: true }
  });
};

const createPlan = async (userId, studentId) => {
  const existing = await prisma.growthPlan.findFirst({
    where: { userId, studentId: Number(studentId) }
  });
  if (existing) {
    const error = new Error('Plan already exists');
    error.status = 400;
    throw error;
  }

  return await prisma.growthPlan.create({
    data: { userId, studentId: Number(studentId) }
  });
};

const updatePlan = async (userId, id, updates) => {
  const plan = await prisma.growthPlan.findUnique({ where: { id: Number(id) } });
  if (!plan || plan.userId !== userId) {
    const error = new Error('Plan not found');
    error.status = 404;
    throw error;
  }

  return await prisma.growthPlan.update({
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
};

const deletePlan = async (userId, id) => {
  const plan = await prisma.growthPlan.findUnique({ where: { id: Number(id) } });
  if (!plan || plan.userId !== userId) {
    const error = new Error('Plan not found');
    error.status = 404;
    throw error;
  }
  await prisma.growthPlan.delete({ where: { id: Number(id) } });
  return { success: true };
};

const calculatePlan = async (userId, id) => {
  const plan = await prisma.growthPlan.findUnique({
    where: { id: Number(id) },
    include: { student: true }
  });
  if (!plan || plan.userId !== userId) {
    const error = new Error('Plan not found');
    error.status = 404;
    throw error;
  }

  const required = calculateRequiredResources(plan);
  return { plan, required };
};

const calculateDynamicPlan = (plan) => {
  if (!plan) {
    const error = new Error('Plan data required');
    error.status = 400;
    throw error;
  }

  const required = calculateRequiredResources(plan);
  return { plan, required };
};

const getEquipmentDrops = () => {
  return getDropData();
};

module.exports = {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  calculatePlan,
  calculateDynamicPlan,
  getEquipmentDrops
};
