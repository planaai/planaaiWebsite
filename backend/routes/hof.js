const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { requireAdmin } = require('../middleware/auth');

// [Public] 명예의 전당 목록 조회
router.get('/', async (req, res) => {
  try {
    const hofList = await prisma.hallOfFame.findMany({
      where: {
        isVisible: true,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            imagePath: true,
            school: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    res.json(hofList);
  } catch (error) {
    console.error('명예의 전당 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// [Admin] 명예의 전당 관리 목록 조회 (숨김 포함)
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const hofList = await prisma.hallOfFame.findMany({
      include: {
        student: {
          select: {
            id: true,
            name: true,
            imagePath: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    res.json(hofList);
  } catch (error) {
    console.error('명예의 전당 관리 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// [Admin] 명예의 전당 추가
router.post('/admin', requireAdmin, async (req, res) => {
  try {
    const { studentId, achievement, isVisible } = req.body;
    
    if (!studentId) {
      return res.status(400).json({ error: '학생 ID가 필요합니다.' });
    }

    const newEntry = await prisma.hallOfFame.create({
      data: {
        studentId: Number(studentId),
        achievement: achievement || '',
        isVisible: isVisible || false,
      },
      include: {
        student: true,
      }
    });
    
    res.status(201).json(newEntry);
  } catch (error) {
    console.error('명예의 전당 추가 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// [Admin] 명예의 전당 수정
router.put('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { achievement, isVisible } = req.body;

    const updatedEntry = await prisma.hallOfFame.update({
      where: { id: Number(id) },
      data: {
        ...(achievement !== undefined && { achievement }),
        ...(isVisible !== undefined && { isVisible }),
      },
      include: {
        student: true,
      }
    });

    res.json(updatedEntry);
  } catch (error) {
    console.error('명예의 전당 수정 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// [Admin] 명예의 전당 삭제
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.hallOfFame.delete({
      where: { id: Number(id) },
    });
    res.status(204).send();
  } catch (error) {
    console.error('명예의 전당 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
