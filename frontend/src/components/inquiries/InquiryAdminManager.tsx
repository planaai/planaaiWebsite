import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Image as ImageIcon, ChevronDown, ChevronUp, Check, Clock } from 'lucide-react';
import { API } from '../../constants';

interface InquiryImage {
  id: number;
  imageUrl: string;
}

interface InquiryResponse {
  id: number;
  content: string;
  createdAt: string;
  admin: { username: string; nickname: string | null };
  images: InquiryImage[];
}

interface Inquiry {
  id: number;
  category: 'BUG_REPORT' | 'RESOURCE_SUPPORT' | 'SUGGESTION';
  subCategory: 'FULL_BODY' | 'ITEM' | 'ETC' | null;
  title: string | null;
  content: string | null;
  status: 'PENDING' | 'ANSWERED';
  createdAt: string;
  user: { username: string; nickname: string | null };
  images: InquiryImage[];
  responses: InquiryResponse[];
}

export const InquiryAdminManager: React.FC<{ showToast: (msg: string, type: 'success' | 'error') => void }> = ({ showToast }) => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyImages, setReplyImages] = useState<File[]>([]);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/inquiries/admin`);
      // 상세 조회를 위해 리스트를 가져온 후 세부 내용도 가져오거나, 
      // 리스트 조회 시 응답/이미지를 포함시키도록 백엔드를 변경했었지만,
      // 백엔드 /api/inquiries/admin 은 리스트만 반환하므로, 상세는 클릭 시 조회하도록 수정할 수도 있음.
      // 편의상 이 컴포넌트에서는 /api/inquiries/admin 응답을 보여주고,
      // 상세 조회는 펼칠 때 하도록 합니다.
      setInquiries(res.data);
    } catch (error) {
      showToast('문의 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleExpand = async (inquiryId: number) => {
    if (expandedId === inquiryId) {
      setExpandedId(null);
      return;
    }
    
    try {
      const res = await axios.get(`${API}/api/inquiries/admin/${inquiryId}`);
      setInquiries(prev => prev.map(inq => inq.id === inquiryId ? res.data : inq));
      setExpandedId(inquiryId);
      setReplyContent('');
      setReplyImages([]);
    } catch (error) {
      showToast('문의 상세 정보를 불러오지 못했습니다.', 'error');
    }
  };

  const handleReplySubmit = async (inquiryId: number) => {
    if (!replyContent.trim()) {
      showToast('답변 내용을 입력해주세요.', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('content', replyContent);
      replyImages.forEach(file => formData.append('images', file));

      await axios.post(`${API}/api/inquiries/admin/${inquiryId}/response`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast('답변이 등록되었습니다.', 'success');
      handleExpand(inquiryId); // 새로고침
    } catch (error) {
      showToast('답변 등록에 실패했습니다.', 'error');
    }
  };

  const categoryLabel = {
    'BUG_REPORT': '오류 제보',
    'RESOURCE_SUPPORT': '리소스 지원',
    'SUGGESTION': '건의사항'
  };

  return (
    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="text-blue-400" size={24} />
        <h2 className="text-2xl font-bold text-white">시스템 문의사항 관리</h2>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">불러오는 중...</div>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-10 text-slate-400 bg-slate-800 rounded-lg">등록된 문의사항이 없습니다.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {inquiries.map((inquiry) => (
            <div key={inquiry.id} className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => handleExpand(inquiry.id)}
              >
                <div className="flex items-center gap-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    inquiry.status === 'ANSWERED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {inquiry.status === 'ANSWERED' ? <span className="flex items-center gap-1"><Check size={12}/> 답변 완료</span> : <span className="flex items-center gap-1"><Clock size={12}/> 답변 대기</span>}
                  </span>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
                    {categoryLabel[inquiry.category]}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium">
                      {inquiry.title || inquiry.subCategory || '제목 없음'}
                    </span>
                    <span className="text-xs text-slate-500">
                      작성자: {inquiry.user.nickname || inquiry.user.username} | {new Date(inquiry.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                {expandedId === inquiry.id ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
              </div>

              {expandedId === inquiry.id && (
                <div className="p-4 border-t border-slate-700 bg-slate-800/30">
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 mb-2">문의 내용</h3>
                    <div className="p-4 bg-slate-900 rounded-lg whitespace-pre-wrap text-sm text-slate-300">
                      {inquiry.content || '(내용 없음)'}
                    </div>
                    {inquiry.images && inquiry.images.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {inquiry.images.map(img => (
                          <img key={img.id} src={`${API}${img.imageUrl}`} alt="첨부 이미지" className="max-h-48 rounded border border-slate-700" />
                        ))}
                      </div>
                    )}
                  </div>

                  {inquiry.responses && inquiry.responses.length > 0 && (
                    <div className="mb-6 pl-4 border-l-2 border-emerald-500">
                      <h3 className="text-sm font-bold text-emerald-400 mb-2">답변 내역</h3>
                      {inquiry.responses.map(res => (
                        <div key={res.id} className="mb-4">
                          <div className="p-4 bg-slate-900 rounded-lg whitespace-pre-wrap text-sm text-slate-300">
                            {res.content}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            답변자: {res.admin.nickname || res.admin.username} | {new Date(res.createdAt).toLocaleString()}
                          </div>
                          {res.images && res.images.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {res.images.map(img => (
                                <img key={img.id} src={`${API}${img.imageUrl}`} alt="답변 첨부 이미지" className="max-h-48 rounded border border-slate-700" />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 border-t border-slate-700 pt-4">
                    <h3 className="text-sm font-bold text-slate-400 mb-2">답변 달기</h3>
                    <textarea
                      value={replyContent}
                      onChange={e => setReplyContent(e.target.value)}
                      className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-blue-500 outline-none resize-none mb-3"
                      placeholder="답변 내용을 입력하세요..."
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400 hover:text-blue-400 transition-colors">
                          <ImageIcon size={16} /> 이미지 첨부 ({replyImages.length}장)
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            className="hidden" 
                            onChange={e => {
                              if (e.target.files) {
                                setReplyImages(Array.from(e.target.files));
                              }
                            }} 
                          />
                        </label>
                      </div>
                      <button 
                        onClick={() => handleReplySubmit(inquiry.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors text-sm"
                      >
                        답변 등록
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
