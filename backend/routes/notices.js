const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { prisma } = require('../db');

const router = express.Router();

// 1. 공지사항 목록 조회 (페이징, 카테고리 필터)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const where = {};
    if (category && category !== 'ALL') {
      where.category = category;
    }

    const notices = await prisma.notice.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { nickname: true, username: true }
        }
      }
    });

    const total = await prisma.notice.count({ where });

    res.json({
      notices,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    console.error('Error fetching notices:', error);
    res.status(500).json({ error: '공지사항 목록을 불러오는데 실패했습니다.' });
  }
});

// 2. 공지사항 상세 조회 (조회수 증가)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const notice = await prisma.notice.update({
      where: { id: Number(id) },
      data: { viewCount: { increment: 1 } },
      include: {
        author: {
          select: { nickname: true, username: true }
        }
      }
    });
    
    if (!notice) {
      return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
    }
    
    res.json(notice);
  } catch (error) {
    console.error('Error fetching notice:', error);
    res.status(500).json({ error: '공지사항을 불러오는데 실패했습니다.' });
  }
});

// 3. 공지사항 작성 (Admin Only)
router.post('/', requireAdmin, async (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  }

  try {
    const notice = await prisma.notice.create({
      data: {
        title,
        content,
        category: category || 'GENERAL',
        authorId: req.user.id
      }
    });
    res.status(201).json(notice);
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({ error: '공지사항 작성에 실패했습니다.' });
  }
});

// 4. 공지사항 수정 (Admin Only)
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, content, category } = req.body;

  try {
    const notice = await prisma.notice.update({
      where: { id: Number(id) },
      data: {
        title,
        content,
        category
      }
    });
    res.json(notice);
  } catch (error) {
    console.error('Error updating notice:', error);
    res.status(500).json({ error: '공지사항 수정에 실패했습니다.' });
  }
});

// 5. 공지사항 삭제 (Admin Only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.notice.delete({
      where: { id: Number(id) }
    });
    res.json({ message: '공지사항이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({ error: '공지사항 삭제에 실패했습니다.' });
  }
});

module.exports = router;
