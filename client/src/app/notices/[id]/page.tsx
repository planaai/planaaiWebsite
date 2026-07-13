'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Calendar, Eye, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface Notice {
  id: number;
  title: string;
  content: string;
  category: 'UPDATE' | 'EVENT' | 'GENERAL';
  viewCount: number;
  createdAt: string;
  author: { nickname: string; username: string };
}

export default function NoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params as { id: string };
  
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    useAuthStore.getState().checkAuth();
    if (id) {
      fetchNotice();
    }
  }, [id]);

  const fetchNotice = async () => {
    try {
      const res = await api.get(`/notices/${id}`);
      setNotice(res.data);
    } catch (error) {
      console.error('Failed to fetch notice:', error);
      alert('공지사항을 찾을 수 없습니다.');
      router.push('/notices');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="animate-pulse text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  if (!notice) return null;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Link href="/notices" className="inline-flex items-center text-sm text-gray-500 hover:text-[var(--plana-primary)] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로 돌아가기
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-3 mb-4">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
              notice.category === 'UPDATE' ? 'bg-green-100 text-green-800' :
              notice.category === 'EVENT' ? 'bg-pink-100 text-pink-800' :
              'bg-gray-200 text-gray-800'
            }`}>
              {notice.category === 'UPDATE' ? '업데이트' : notice.category === 'EVENT' ? '이벤트' : '일반'}
            </span>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-snug">
            {notice.title}
          </h1>
          
          <div className="flex flex-wrap items-center text-sm text-gray-500 gap-6">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-2 opacity-70" />
              <span>{notice.author?.nickname || notice.author?.username || '관리자'}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 opacity-70" />
              <span>{format(new Date(notice.createdAt), 'yyyy년 MM월 dd일 HH:mm')}</span>
            </div>
            <div className="flex items-center">
              <Eye className="w-4 h-4 mr-2 opacity-70" />
              <span>조회 {notice.viewCount}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 md:p-10">
          <div className="prose prose-blue max-w-none prose-headings:font-bold prose-a:text-blue-600 hover:prose-a:text-blue-500 prose-img:rounded-xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {notice.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
