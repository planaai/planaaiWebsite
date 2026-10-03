require('dotenv').config();
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const authService = require('../services/authService');

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
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({ status: 'success', user });
  } catch (error) {
    console.error('Register error:', error);
    const status = error.status || (error.message.includes('인증 실패') || error.message.includes('ID와 비밀번호') ? 400 : 500);
    res.status(status).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', authLimiter, async (req, res) => {
  try {
    const data = await authService.loginUser(req.body);
    res.json({ status: 'success', ...data });
  } catch (error) {
    console.error('Login error:', error);
    const status = error.status || 401;
    res.status(status).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 내 정보 확인
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ status: 'success', user });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 닉네임 변경
router.put('/me', requireAuth, async (req, res) => {
  try {
    const user = await authService.updateMe(req.user.id, req.body);
    res.json({ status: 'success', user });
  } catch (error) {
    console.error('Update profile error:', error);
    const status = error.message.includes('닉네임') ? 400 : 500;
    res.status(status).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 관리자: 쉐도우밴 유저 목록 조회
router.get('/admin/shadowbanned', requireAdmin, async (req, res) => {
  try {
    const users = await authService.getShadowbannedUsers();
    res.json({ status: 'success', users });
  } catch (error) {
    console.error('Shadowban list error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 관리자: 쉐도우밴 유저 해제
router.put('/admin/shadowban/:id/unban', requireAdmin, async (req, res) => {
  try {
    const result = await authService.unbanShadowbannedUser(req.params.id);
    res.json({ status: 'success', ...result });
  } catch (error) {
    console.error('Shadowban unban error:', error);
    const status = error.message.includes('유효하지 않은') ? 400 : 500;
    res.status(status).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
