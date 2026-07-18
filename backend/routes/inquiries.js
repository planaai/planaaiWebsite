const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// 1. 문의 작성 (유저)
// upload.array('images') 로 다중 이미지를 받음
router.post('/', requireAuth, upload.array('images'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, subCategory, title, content } = req.body;
    
    // 필수값 체크
    if (!category) {
      return res.status(400).json({ error: '카테고리는 필수입니다.' });
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        userId,
        category,
        subCategory: subCategory || null,
        title: title || null,
        content: content || null,
      }
    });

    // 업로드된 이미지 저장
    if (req.files && req.files.length > 0) {
      const imagePromises = req.files.map(file => {
        return prisma.inquiryImage.create({
          data: {
            inquiryId: inquiry.id,
            imageUrl: `/uploads/inquiries/${file.filename}`
          }
        });
      });
      await Promise.all(imagePromises);
    }

    res.status(201).json({ message: '문의가 성공적으로 접수되었습니다.', inquiry });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    res.status(500).json({ error: '서버 오류로 문의를 작성할 수 없습니다.' });
  }
});

// 2. 내 문의 내역 조회 (유저)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const inquiries = await prisma.inquiry.findMany({
      where: { userId },
      include: {
        images: true,
        responses: {
          include: {
            images: true,
            admin: {
              select: { username: true, nickname: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(inquiries);
  } catch (error) {
    console.error('Error fetching my inquiries:', error);
    res.status(500).json({ error: '문의 내역을 가져오는데 실패했습니다.' });
  }
});

// 3. 관리자: 모든 문의 내역 조회
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const { category, status } = req.query;
    
    const whereClause = {};
    if (category) whereClause.category = category;
    if (status) whereClause.status = status;

    const inquiries = await prisma.inquiry.findMany({
      where: whereClause,
      include: {
        user: { select: { username: true, nickname: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(inquiries);
  } catch (error) {
    console.error('Error fetching admin inquiries:', error);
    res.status(500).json({ error: '문의 목록을 가져오는데 실패했습니다.' });
  }
});

// 4. 관리자: 특정 문의 상세 조회
router.get('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, nickname: true } },
        images: true,
        responses: {
          include: {
            images: true,
            admin: { select: { username: true, nickname: true } }
          }
        }
      }
    });

    if (!inquiry) return res.status(404).json({ error: '해당 문의를 찾을 수 없습니다.' });
    
    res.json(inquiry);
  } catch (error) {
    console.error('Error fetching inquiry detail:', error);
    res.status(500).json({ error: '문의 상세를 가져오는데 실패했습니다.' });
  }
});

// 5. 관리자: 문의 답변 작성
router.post('/admin/:id/response', requireAdmin, upload.array('images'), async (req, res) => {
  try {
    const adminId = req.user.id;
    const inquiryId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: '답변 내용은 필수입니다.' });
    }

    const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry) return res.status(404).json({ error: '해당 문의를 찾을 수 없습니다.' });

    // 답변 저장
    const response = await prisma.inquiryResponse.create({
      data: {
        inquiryId,
        adminId,
        content
      }
    });

    // 답변 이미지 저장
    if (req.files && req.files.length > 0) {
      const imagePromises = req.files.map(file => {
        return prisma.responseImage.create({
          data: {
            responseId: response.id,
            imageUrl: `/uploads/inquiries/${file.filename}`
          }
        });
      });
      await Promise.all(imagePromises);
    }

    // 문의 상태를 'ANSWERED'로 변경
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status: 'ANSWERED' }
    });

    res.status(201).json({ message: '답변이 성공적으로 등록되었습니다.', response });
  } catch (error) {
    console.error('Error creating response:', error);
    res.status(500).json({ error: '답변을 등록하는데 실패했습니다.' });
  }
});

module.exports = router;
