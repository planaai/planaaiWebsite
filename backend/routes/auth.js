require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { requireAuth, requireAdmin, JWT_SECRET } = require('../middleware/auth');
const { verifyRecaptcha } = require('../utils/recaptcha');
const { prisma } = require('../db');

const router = express.Router();
const rateLimit = require('express-rate-limit');

// 로그인/회원가입 요청 제한 (15분에 10회)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.' }
});

// 회원가입
router.post('/register', authLimiter, async (req, res) => {
  const { username, password, turnstileToken } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ID와 비밀번호를 입력해주세요.' });
  }

  // Turnstile 검증
  const isHuman = await verifyRecaptcha(turnstileToken);
  if (!isHuman) {
    return res.status(403).json({ error: '비정상적인 접근이 감지되었습니다. (보안 인증 실패)' });
  }

  try {
    // 이미 존재하는 username 확인
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(409).json({ error: '이미 존재하는 ID입니다.' });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성 (uid는 autoincrement로 자동 생성됨)
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    res.status(201).json({ status: 'success', user: { id: newUser.id, uid: newUser.uid, username: newUser.username, nickname: newUser.nickname } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ID와 비밀번호를 입력해주세요.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'ID 또는 비밀번호가 일치하지 않습니다.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'ID 또는 비밀번호가 일치하지 않습니다.' });
    }

    // JWT 발급
    const token = jwt.sign(
      { id: user.id, uid: user.uid, username: user.username, nickname: user.nickname, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' } // 7일 유지
    );

    res.json({
      status: 'success',
      token,
      user: { id: user.id, uid: user.uid, username: user.username, nickname: user.nickname, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 내 정보 확인
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({
      status: 'success',
      user: { id: user.id, uid: user.uid, username: user.username, nickname: user.nickname, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 닉네임 변경
router.put('/me', requireAuth, async (req, res) => {
  const { nickname } = req.body;
  
  if (nickname !== undefined && (typeof nickname !== 'string' || nickname.trim().length > 20)) {
    return res.status(400).json({ error: '닉네임은 20자 이내의 문자열이어야 합니다.' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { nickname: nickname ? nickname.trim() : null }
    });

    res.json({
      status: 'success',
      user: { id: updatedUser.id, uid: updatedUser.uid, username: updatedUser.username, nickname: updatedUser.nickname, role: updatedUser.role }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 관리자: 쉐도우밴 유저 목록 조회
router.get('/admin/shadowbanned', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isShadowBanned: true },
      select: {
        id: true,
        uid: true,
        username: true,
        nickname: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json({ status: 'success', users });
  } catch (error) {
    console.error('Shadowban list error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 관리자: 쉐도우밴 유저 해제
router.put('/admin/shadowban/:id/unban', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '유효하지 않은 유저 ID입니다.' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isShadowBanned: false }
    });

    res.json({ status: 'success', message: '쉐도우밴이 해제되었습니다.' });
  } catch (error) {
    console.error('Shadowban unban error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
