import { useState, useEffect } from 'react';
import axios from 'axios';
import { Pencil, Trash2, Plus, X, Save } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { API } from '../../constants';
import { format } from 'date-fns';

interface Notice {
  id: number;
  title: string;
  content: string;
  category: 'UPDATE' | 'EVENT' | 'GENERAL';
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author?: { nickname: string; username: string };
}

export function NoticeManager() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentNotice, setCurrentNotice] = useState<Partial<Notice>>({ category: 'GENERAL' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    fetchNotices();
  }, [page, categoryFilter]);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/notices`, {
        params: { page, limit: 10, category: categoryFilter }
      });
      setNotices(res.data.notices);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch notices', error);
      alert('공지사항을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentNotice.title || !currentNotice.content) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      if (currentNotice.id) {
        await axios.put(`${API}/api/notices/${currentNotice.id}`, currentNotice);
      } else {
        await axios.post(`${API}/api/notices`, currentNotice);
      }
      setIsEditing(false);
      setCurrentNotice({ category: 'GENERAL' });
      fetchNotices();
    } catch (error) {
      console.error('Failed to save notice', error);
      alert('공지사항 저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API}/api/notices/${id}`);
      fetchNotices();
    } catch (error) {
      console.error('Failed to delete notice', error);
      alert('공지사항 삭제에 실패했습니다.');
    }
  };

  if (isEditing) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{currentNotice.id ? '공지사항 수정' : '새 공지사항 작성'}</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-2" /> 취소
            </button>
            <button
              onClick={handleSave}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" /> 저장
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex space-x-4">
            <select
              value={currentNotice.category || 'GENERAL'}
              onChange={(e) => setCurrentNotice({ ...currentNotice, category: e.target.value as any })}
              className="border rounded-md px-3 py-2 w-48"
            >
              <option value="GENERAL">일반</option>
              <option value="UPDATE">업데이트</option>
              <option value="EVENT">이벤트</option>
            </select>
            <input
              type="text"
              placeholder="제목을 입력하세요"
              value={currentNotice.title || ''}
              onChange={(e) => setCurrentNotice({ ...currentNotice, title: e.target.value })}
              className="flex-1 border rounded-md px-3 py-2"
            />
          </div>
          
          <div data-color-mode="light">
            <MDEditor
              value={currentNotice.content || ''}
              onChange={(val) => setCurrentNotice({ ...currentNotice, content: val || '' })}
              height={500}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">공지사항 관리</h2>
        <button
          onClick={() => {
            setCurrentNotice({ category: 'GENERAL', title: '', content: '' });
            setIsEditing(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" /> 새 공지사항
        </button>
      </div>

      <div className="flex mb-4">
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="border rounded-md px-3 py-2"
        >
          <option value="ALL">전체 카테고리</option>
          <option value="GENERAL">일반</option>
          <option value="UPDATE">업데이트</option>
          <option value="EVENT">이벤트</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-left">
              <th className="p-3 font-medium text-gray-600">ID</th>
              <th className="p-3 font-medium text-gray-600">카테고리</th>
              <th className="p-3 font-medium text-gray-600">제목</th>
              <th className="p-3 font-medium text-gray-600">작성자</th>
              <th className="p-3 font-medium text-gray-600">조회수</th>
              <th className="p-3 font-medium text-gray-600">작성일</th>
              <th className="p-3 font-medium text-gray-600">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center p-4">로딩중...</td></tr>
            ) : notices.length === 0 ? (
              <tr><td colSpan={7} className="text-center p-4">공지사항이 없습니다.</td></tr>
            ) : (
              notices.map((notice) => (
                <tr key={notice.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{notice.id}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      notice.category === 'UPDATE' ? 'bg-green-100 text-green-800' :
                      notice.category === 'EVENT' ? 'bg-pink-100 text-pink-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {notice.category === 'UPDATE' ? '업데이트' : notice.category === 'EVENT' ? '이벤트' : '일반'}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{notice.title}</td>
                  <td className="p-3">{notice.author?.nickname || notice.author?.username}</td>
                  <td className="p-3">{notice.viewCount}</td>
                  <td className="p-3">{format(new Date(notice.createdAt), 'yyyy-MM-dd')}</td>
                  <td className="p-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setCurrentNotice(notice);
                          setIsEditing(true);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="수정"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(notice.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center mt-6 space-x-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded ${page === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
