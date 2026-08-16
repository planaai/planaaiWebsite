'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useAlert } from '@/contexts/AlertContext';
import { format } from 'date-fns';
import { Camera, Image as ImageIcon, Send, MessageSquare, Clock, Check } from 'lucide-react';

type Tab = 'WRITE_BUG' | 'WRITE_RESOURCE' | 'WRITE_SUGGESTION' | 'MY_INQUIRIES';

export default function InquiriesPage() {
  const { showAlert } = useAlert();
  const user = useAuthStore(state => state.user);
  const checkAuth = useAuthStore(state => state.checkAuth);
  
  const [activeTab, setActiveTab] = useState<Tab>('WRITE_BUG');
  const [loading, setLoading] = useState(false);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subCategory, setSubCategory] = useState<'FULL_BODY' | 'ITEM' | 'ETC'>('FULL_BODY');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // 내 문의 내역 상태
  const [myInquiries, setMyInquiries] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 작성 중 변경사항 감지
  const isDirty = title.trim() !== '' || content.trim() !== '' || images.length > 0;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && activeTab !== 'MY_INQUIRIES') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, activeTab]);

  useEffect(() => {
    if (activeTab === 'MY_INQUIRIES' && user) {
      fetchMyInquiries();
    }
  }, [activeTab, user]);

  const fetchMyInquiries = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inquiries/me');
      setMyInquiries(res.data);
    } catch (error) {
      showAlert('오류', '문의 내역을 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImages(prev => [...prev, ...filesArray]);
      
      const newUrls = filesArray.map(file => URL.createObjectURL(file));
      setImagePreviewUrls(prev => [...prev, ...newUrls]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => {
      const newUrls = [...prev];
      URL.revokeObjectURL(newUrls[index]);
      newUrls.splice(index, 1);
      return newUrls;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showAlert('알림', '로그인 후 이용할 수 있습니다.');
      return;
    }

    if (activeTab === 'WRITE_RESOURCE' && !title.trim()) {
      showAlert('알림', '캐릭터/아이템 이름을 입력해주세요.');
      return;
    }
    
    if ((activeTab === 'WRITE_BUG' || activeTab === 'WRITE_SUGGESTION') && (!title.trim() || !content.trim())) {
      showAlert('알림', '제목과 내용을 모두 입력해주세요.');
      return;
    }

    if (activeTab === 'WRITE_RESOURCE' && images.length === 0) {
      showAlert('알림', '지원하실 이미지 리소스를 첨부해주세요.');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      
      let category = 'BUG_REPORT';
      if (activeTab === 'WRITE_RESOURCE') category = 'RESOURCE_SUPPORT';
      if (activeTab === 'WRITE_SUGGESTION') category = 'SUGGESTION';

      formData.append('category', category);
      if (activeTab === 'WRITE_RESOURCE') {
        formData.append('subCategory', subCategory);
        formData.append('title', title); // 리소스 이름
      } else {
        formData.append('title', title);
        formData.append('content', content);
      }

      images.forEach(img => {
        formData.append('images', img);
      });

      await api.post('/inquiries', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showAlert('성공', '문의가 성공적으로 접수되었습니다.');
      
      // 폼 초기화
      setTitle('');
      setContent('');
      setImages([]);
      setImagePreviewUrls([]);
      
      // 내 문의 내역으로 이동
      setActiveTab('MY_INQUIRIES');
    } catch (error) {
      showAlert('오류', '문의 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch(cat) {
      case 'BUG_REPORT': return '오류 제보';
      case 'RESOURCE_SUPPORT': return '리소스 지원';
      case 'SUGGESTION': return '건의사항';
      default: return '기타';
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <MessageSquare className="mx-auto text-slate-300 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-600 mb-2">로그인이 필요합니다</h2>
        <p className="text-slate-500">문의사항을 남기거나 내역을 확인하려면 로그인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-[var(--plana-primary)]">문의사항</h1>
      
      {/* 탭 영역 */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 pb-4">
        {[
          { id: 'WRITE_BUG', label: '오류 제보' },
          { id: 'WRITE_RESOURCE', label: '이미지 리소스 지원' },
          { id: 'WRITE_SUGGESTION', label: '건의사항' },
          { id: 'MY_INQUIRIES', label: '내 문의 내역' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as Tab);
              setTitle('');
              setContent('');
              setImages([]);
              setImagePreviewUrls([]);
            }}
            className={`px-5 py-2.5 rounded-t-lg font-bold transition-colors ${
              activeTab === tab.id 
              ? 'bg-[var(--plana-primary)] text-white shadow-md' 
              : 'bg-white text-gray-500 hover:bg-pink-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 작성 폼 영역 */}
      {activeTab !== 'MY_INQUIRIES' && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
          
          <div className="mb-6 pb-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">
              {activeTab === 'WRITE_BUG' ? '오류 제보 작성' : activeTab === 'WRITE_SUGGESTION' ? '건의사항 작성' : '이미지 리소스 지원'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === 'WRITE_BUG' && '사이트 이용 중 발견하신 오류를 자세히 알려주시면 수정에 큰 도움이 됩니다.'}
              {activeTab === 'WRITE_SUGGESTION' && '사이트 발전을 위한 좋은 아이디어가 있다면 자유롭게 남겨주세요.'}
              {activeTab === 'WRITE_RESOURCE' && '누락된 캐릭터 전신 일러스트나 아이템 등의 이미지를 지원해주세요.'}
            </p>
            
            {activeTab === 'WRITE_BUG' && (
              <div className="mt-4">
                <Link href="/notices/4" target="_blank" className="inline-flex items-center px-4 py-2 bg-pink-50 text-[var(--plana-primary)] text-sm font-bold rounded-lg border border-pink-100 hover:bg-pink-100 transition-colors">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  오류 제보 전 드리는 말씀
                </Link>
              </div>
            )}
            
            {activeTab === 'WRITE_RESOURCE' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/notices/5" target="_blank" className="inline-flex items-center px-4 py-2 bg-green-50 text-green-700 text-sm font-bold rounded-lg border border-green-100 hover:bg-green-100 transition-colors">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  엔비디아 그래픽카드 전용
                </Link>
                <Link href="/notices/6" target="_blank" className="inline-flex items-center px-4 py-2 bg-red-50 text-red-700 text-sm font-bold rounded-lg border border-red-100 hover:bg-red-100 transition-colors">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  라데온 그래픽카드 전용
                </Link>
              </div>
            )}
          </div>

          {activeTab === 'WRITE_RESOURCE' && (
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">분류 <span className="text-red-500">*</span></label>
              <select 
                value={subCategory} 
                onChange={e => setSubCategory(e.target.value as any)}
                className="w-full md:w-1/3 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[var(--plana-primary-light)] focus:border-transparent outline-none"
              >
                <option value="FULL_BODY">전신 일러스트</option>
                <option value="ITEM">아이템/장비</option>
                <option value="ETC">기타</option>
              </select>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {activeTab === 'WRITE_RESOURCE' ? '캐릭터 / 아이템 이름' : '제목'} <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              placeholder={activeTab === 'WRITE_RESOURCE' ? '예: [전신] 호시노 (수영복)' : '제목을 입력하세요'}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[var(--plana-primary-light)] focus:border-transparent outline-none"
            />
          </div>

          {activeTab !== 'WRITE_RESOURCE' && (
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">내용 <span className="text-red-500">*</span></label>
              <textarea 
                value={content} 
                onChange={e => setContent(e.target.value)}
                placeholder="상세 내용을 입력하세요"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 h-48 resize-none focus:ring-2 focus:ring-[var(--plana-primary-light)] focus:border-transparent outline-none"
              />
            </div>
          )}

          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              이미지 첨부 {activeTab === 'WRITE_RESOURCE' && <span className="text-red-500">*</span>}
            </label>
            <div className="flex flex-wrap gap-4 items-start">
              <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-[var(--plana-primary-light)] transition-colors">
                <Camera className="text-gray-400 mb-1" size={24} />
                <span className="text-xs text-gray-500 font-medium">{images.length}장</span>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageChange}
                />
              </label>
              
              {imagePreviewUrls.map((url, idx) => (
                <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
                  <img src={url} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button 
                      type="button" 
                      onClick={() => removeImage(idx)}
                      className="text-white text-xs font-bold px-2 py-1 bg-red-500 rounded"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">※ 다중 이미지 첨부가 가능합니다. 최대 10MB 이하의 이미지 파일만 업로드해주세요.</p>
          </div>

          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="flex items-center gap-2 bg-[var(--plana-primary)] text-white px-8 py-3 rounded-lg font-bold hover:bg-pink-500 transition-colors shadow-md disabled:opacity-50"
            >
              <Send size={18} />
              {loading ? '등록 중...' : '문의 등록하기'}
            </button>
          </div>
        </form>
      )}

      {/* 내 문의 내역 영역 */}
      {activeTab === 'MY_INQUIRIES' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 animate-pulse">불러오는 중...</div>
          ) : myInquiries.length === 0 ? (
            <div className="p-12 text-center text-gray-400">등록된 문의 내역이 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {myInquiries.map(inq => (
                <div key={inq.id} className="p-0">
                  <div 
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(expandedId === inq.id ? null : inq.id)}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        inq.status === 'ANSWERED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {inq.status === 'ANSWERED' ? <span className="flex items-center gap-1"><Check size={12}/>답변 완료</span> : <span className="flex items-center gap-1"><Clock size={12}/>답변 대기</span>}
                      </span>
                      <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                        {getCategoryLabel(inq.category)}
                      </span>
                      <h3 className="font-bold text-gray-800 text-[15px]">
                        {inq.title || inq.subCategory || '제목 없음'}
                      </h3>
                      {inq.images?.length > 0 && <ImageIcon size={14} className="text-gray-400" />}
                    </div>
                    <div className="text-sm text-gray-400 font-medium">
                      {format(new Date(inq.createdAt), 'yyyy.MM.dd HH:mm')}
                    </div>
                  </div>

                  {/* 펼침 내용 */}
                  {expandedId === inq.id && (
                    <div className="p-6 bg-gray-50 border-t border-gray-100">
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                          <span className="font-bold text-gray-700">나의 문의 내용</span>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200 text-gray-600 text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
                          {inq.content || '(내용이 없습니다)'}
                        </div>
                        {inq.images?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {inq.images.map((img: any) => (
                              <img key={img.id} src={`https://api.planaai.kro.kr${img.imageUrl}`} alt="attachment" className="max-h-32 rounded border border-gray-200" />
                            ))}
                          </div>
                        )}
                      </div>

                      {inq.responses && inq.responses.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--plana-primary)]"></span>
                            <span className="font-bold text-[var(--plana-primary)]">관리자 답변</span>
                          </div>
                          {inq.responses.map((res: any) => (
                            <div key={res.id} className="bg-white p-4 rounded-lg border border-[var(--plana-primary-light)] shadow-sm mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">
                                  {res.admin?.nickname || '관리자'}
                                </span>
                                <span className="text-xs text-gray-400">{format(new Date(res.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                              </div>
                              <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                                {res.content}
                              </div>
                              {res.images?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {res.images.map((img: any) => (
                                    <img key={img.id} src={`https://api.planaai.kro.kr${img.imageUrl}`} alt="admin attachment" className="max-h-32 rounded border border-gray-200" />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
