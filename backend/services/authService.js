const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { verifyRecaptcha } = require('../utils/recaptcha');
const { prisma } = require('../db');

const registerUser = async (data) => {
  const { username, password, turnstileToken } = data;
  
  if (!username || !password) {
    throw new Error('ID와 비밀번호를 입력해주세요.');
  }

  const isHuman = await verifyRecaptcha(turnstileToken);
  if (!isHuman) {
    throw new Error('비정상적인 접근이 감지되었습니다. (보안 인증 실패)');
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    const error = new Error('이미 존재하는 ID입니다.');
    error.status = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: { username, password: hashedPassword }
  });

  return { id: newUser.id, uid: newUser.uid, username: newUser.username, nickname: newUser.nickname };
};

const loginUser = async (data) => {
  const { username, password } = data;
  if (!username || !password) {
    throw new Error('ID와 비밀번호를 입력해주세요.');
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    const error = new Error('ID 또는 비밀번호가 일치하지 않습니다.');
    error.status = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('ID 또는 비밀번호가 일치하지 않습니다.');
    error.status = 401;
    throw error;
  }

  const token = jwt.sign(
    { id: user.id, uid: user.uid, username: user.username, nickname: user.nickname, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: { id: user.id, uid: user.uid, username: user.username, nickname: user.nickname, role: user.role }
  };
};

const getMe = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error('사용자를 찾을 수 없습니다.');
    error.status = 404;
    throw error;
  }
  return { id: user.id, uid: user.uid, username: user.username, nickname: user.nickname, role: user.role };
};

const updateMe = async (userId, data) => {
  const { nickname } = data;
  if (nickname !== undefined && (typeof nickname !== 'string' || nickname.trim().length > 20)) {
    throw new Error('닉네임은 20자 이내의 문자열이어야 합니다.');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { nickname: nickname ? nickname.trim() : null }
  });

  return { id: updatedUser.id, uid: updatedUser.uid, username: updatedUser.username, nickname: updatedUser.nickname, role: updatedUser.role };
};

const getShadowbannedUsers = async () => {
  return await prisma.user.findMany({
    where: { isShadowBanned: true },
    select: {
      id: true, uid: true, username: true, nickname: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' }
  });
};

const unbanShadowbannedUser = async (userIdStr) => {
  const userId = parseInt(userIdStr, 10);
  if (isNaN(userId)) {
    throw new Error('유효하지 않은 유저 ID입니다.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isShadowBanned: false }
  });

  return { message: '쉐도우밴이 해제되었습니다.' };
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  getShadowbannedUsers,
  unbanShadowbannedUser
};
