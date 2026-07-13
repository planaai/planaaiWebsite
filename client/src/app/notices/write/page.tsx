'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useAlert } from '@/contexts/AlertContext';

export default function WriteNoticePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showAlert } = useAlert();
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'UPDATE' | 'EVENT' | 'GENERAL'>('GENERAL');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Redirect if not admin
    if (user && user.role !== 'ADMIN') {
      showAlert('접근 거부', '관리자 권한이 필요합니다.');
      router.push('/notices');
    }
  }, [user, router, showAlert]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showAlert('입력 오류', '제목과 내용을 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/notices', { title, category, content });
      showAlert('성공', '공지사항이 등록되었습니다.');
      router.push('/notices');
    } catch (error) {
      console.error('Failed to create notice:', error);
      showAlert('오류', '공지사항 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || user.role !== 'ADMIN') {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-[var(--plana-primary)]">공지사항 작성</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-4">
            <div className="w-1/4">
              <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] bg-white text-sm"
              >
                <option value="GENERAL">일반</option>
                <option value="UPDATE">업데이트</option>
                <option value="EVENT">이벤트</option>
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="공지사항 제목을 입력하세요"
                className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] text-sm"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="공지사항 내용을 입력하세요"
              className="w-full border border-gray-300 rounded-md px-4 py-2 h-64 focus:outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] text-sm resize-none"
              required
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[var(--plana-primary)] text-white rounded-md text-sm font-medium hover:bg-pink-500 transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
