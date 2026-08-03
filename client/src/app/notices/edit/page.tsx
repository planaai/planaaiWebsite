'use client';



import { useState, useEffect } from 'react';
import { useRouter, useSearchParams,  } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useAlert } from '@/contexts/AlertContext';

import dynamic from 'next/dynamic';

const HtmlEditor = dynamic(() => import('@/components/common/HtmlEditor'), {
  ssr: false,
  loading: () => <div className="h-64 w-full border border-gray-300 rounded-md bg-gray-50 flex items-center justify-center text-gray-400">에디터 로딩 중...</div>
});

function EditNoticePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') as string;
  const { user } = useAuthStore();
  const { showAlert } = useAlert();
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'UPDATE' | 'EVENT' | 'GENERAL'>('GENERAL');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Redirect if not admin
    if (user && user.role !== 'ADMIN') {
      showAlert('접근 거부', '관리자 권한이 필요합니다.');
      router.push('/notices');
      return;
    }

    const fetchNotice = async () => {
      try {
        const res = await api.get(`/notices/${id}`);
        setTitle(res.data.title);
        setCategory(res.data.category);
        setContent(res.data.content);
      } catch (error) {
        console.error('Failed to fetch notice:', error);
        showAlert('오류', '공지사항을 불러오는데 실패했습니다.');
        router.push('/notices');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchNotice();
    }
  }, [user, router, showAlert, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showAlert('입력 오류', '제목과 내용을 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.put(`/notices/${id}`, { title, category, content });
      showAlert('성공', '공지사항이 수정되었습니다.');
      router.push(`/notices/detail?id=${id}`);
    } catch (error) {
      console.error('Failed to update notice:', error);
      showAlert('오류', '공지사항 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || user.role !== 'ADMIN') {
    return null; // Will redirect in useEffect
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="animate-pulse text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-[var(--plana-primary)]">공지사항 수정</h1>
      
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
            <HtmlEditor
              value={content}
              onChange={setContent}
              placeholder="공지사항 내용을 입력하세요"
              minHeight="400px"
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
              {isSubmitting ? '수정 중...' : '수정하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


import { Suspense } from 'react';

export default function EditNoticePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading...</div>}>
      <EditNoticePageContent />
    </Suspense>
  );
}
