'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface Notice {
  id: number;
  title: string;
  category: 'UPDATE' | 'EVENT' | 'GENERAL';
  viewCount: number;
  createdAt: string;
  author: { nickname: string; username: string };
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    useAuthStore.getState().checkAuth();
    fetchNotices();
  }, [page, categoryFilter]);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notices', {
        params: { page, limit: 10, category: categoryFilter }
      });
      setNotices(res.data.notices);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-[var(--plana-primary)]">공지사항</h1>
      
      <div className="flex justify-between items-center mb-6">
        <div className="flex">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-md px-4 py-2 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)]"
          >
            <option value="ALL">전체보기</option>
            <option value="GENERAL">일반</option>
            <option value="UPDATE">업데이트</option>
            <option value="EVENT">이벤트</option>
          </select>
        </div>
        {user?.role === 'ADMIN' && (
          <Link href="/notices/write" className="bg-[var(--plana-primary)] text-white px-4 py-2 text-sm rounded-md font-medium hover:bg-pink-500 transition-colors shadow-sm">
            글쓰기
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">카테고리</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">제목</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">작성일</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">조회수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                  <div className="animate-pulse">데이터를 불러오는 중입니다...</div>
                </td>
              </tr>
            ) : notices.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                  등록된 공지사항이 없습니다.
                </td>
              </tr>
            ) : (
              notices.map((notice) => (
                <tr key={notice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${
                      notice.category === 'UPDATE' ? 'bg-green-50 text-green-700 border border-green-200' :
                      notice.category === 'EVENT' ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                      'bg-gray-50 text-gray-700 border border-gray-200'
                    }`}>
                      {notice.category === 'UPDATE' ? '업데이트' : notice.category === 'EVENT' ? '이벤트' : '일반'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/notices/${notice.id}`} className="text-[15px] text-gray-900 font-medium hover:text-[var(--plana-primary)] transition-colors line-clamp-1">
                      {notice.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">
                    {format(new Date(notice.createdAt), 'yyyy.MM.dd')}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-400">
                    {notice.viewCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center mt-8 space-x-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                page === i + 1 
                  ? 'bg-[var(--plana-primary)] text-white shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
