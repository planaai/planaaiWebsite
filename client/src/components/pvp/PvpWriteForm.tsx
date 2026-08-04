"use client";

import React, { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api, getImageUrl } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useFormationStore } from '@/store/formationStore';
import { Loader2, ArrowLeft, Upload, Users, X } from 'lucide-react';
import type { StudentMaster } from '@/types';
import type { PvpParty, PvpPartyData } from '@/types/pvp';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const HtmlEditor = dynamic(() => import('@/components/common/HtmlEditor'), {
  ssr: false,
  loading: () => <div className="h-48 w-full border border-pink-200 rounded-lg bg-pink-50 flex items-center justify-center text-pink-400">에디터 로딩 중...</div>
});

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[3] : null;
}

interface Props {
  masterData: StudentMaster[];
  initialData?: PvpParty;
}

export function PvpWriteForm({ masterData, initialData }: Props) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { rosterType, getAllFormations } = useFormationStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const [formData, setFormData] = useState({
    deckType: initialData?.deckType || 'Attack',
    name: initialData?.name || '',
    tags: initialData?.tags?.join(', ') || '',
    tactics: initialData?.tactics || '',
  });

  const [party, setParty] = useState<PvpPartyData | null>(
    initialData?.party || null
  );

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imagePath ? getImageUrl(initialData.imagePath) : null);
  const [youtubeUrls, setYoutubeUrls] = useState<{url: string; title: string; channel: string}[]>(
    initialData?.youtubeUrls?.map(u => typeof u === 'string' ? {url: u, title: '', channel: ''} : {url: (u as any).url, title: (u as any).title || '', channel: (u as any).channel || ''}) || []
  );

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchedUrls = useRef<Set<string>>(new Set());

  React.useEffect(() => {
    youtubeUrls.forEach((video, index) => {
      const videoId = extractYouTubeVideoId(video.url);
      if (videoId && !fetchedUrls.current.has(video.url)) {
        fetchedUrls.current.add(video.url);
        
        api.get(`/raids/youtube-meta?url=${encodeURIComponent(video.url)}`)
          .then(res => {
            if (res.data.title || res.data.channel) {
              setYoutubeUrls(prev => {
                const newUrls = [...prev];
                if (newUrls[index] && newUrls[index].url === video.url) {
                  const fetchedTitle = res.data.title || '';
                  const fetchedChannel = res.data.channel || '';
                  const combined = [fetchedTitle, fetchedChannel].filter(Boolean).join(' - ');
                  newUrls[index] = { 
                    ...newUrls[index], 
                    title: combined || newUrls[index].title,
                    channel: ''
                  };
                }
                return newUrls;
              });
            }
          })
          .catch(err => console.error('Failed to fetch youtube meta', err));
      }
    });
  }, [youtubeUrls]);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FORMATION_DATA') {
        try {
          const parsed = JSON.parse(event.data.payload);
          if (parsed && parsed.state) {
            useFormationStore.setState(parsed.state);
          }
        } catch (e) {
          console.error('Failed to parse formation data', e);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const exportUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/formation-export' 
    : 'https://planaai.kro.kr/formation-export';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleYoutubeUrlChange = (index: number, field: 'url' | 'title' | 'channel', value: string) => {
    const newUrls = [...youtubeUrls];
    newUrls[index] = { ...newUrls[index], [field]: value };
    setYoutubeUrls(newUrls);
  };

  const addYoutubeUrl = () => {
    if (youtubeUrls.length < 5) {
      setYoutubeUrls([...youtubeUrls, { url: '', title: '', channel: '' }]);
    }
  };

  const removeYoutubeUrl = (index: number) => {
    const newUrls = [...youtubeUrls];
    newUrls.splice(index, 1);
    setYoutubeUrls(newUrls);
  };

  const getRelevantTeams = (): { validTeams: import('@/store/formationStore').Team[]; activeId: string | null } => {
    if (!isMounted) return { validTeams: [], activeId: null };
    // PvP doesn't have a specific mode in formation store, usually users use normal or raid mode.
    // We will just look at 'normal' mode first.
    const allFormations = getAllFormations();
    const primaryKey = `normal_${rosterType}`;
    const primaryFormation = allFormations[primaryKey];
    
    let teams: import('@/store/formationStore').Team[] = [];
    let activeId: string | null = null;

    if (primaryFormation && primaryFormation.teams.some(t => 
      t.strikers.some(s => s !== null) || t.specials.some(s => s !== null)
    )) {
      teams = primaryFormation.teams;
      activeId = primaryFormation.activeTeamId;
    } else {
      const fallbackKey = `normal_${rosterType === 'collection' ? 'all' : 'collection'}`;
      const fallbackFormation = allFormations[fallbackKey];
      
      if (fallbackFormation && fallbackFormation.teams.some(t => 
        t.strikers.some(s => s !== null) || t.specials.some(s => s !== null)
      )) {
        teams = fallbackFormation.teams;
        activeId = fallbackFormation.activeTeamId;
      }
    }
    
    // Filter out completely empty teams
    const validTeams = teams.filter(t => !t.strikers.every(s => s === null) || !t.specials.every(s => s === null));
    return { validTeams, activeId };
  };

  const openImportModal = () => {
    const { validTeams, activeId } = getRelevantTeams();
    if (validTeams.length === 0) {
      toast.error('모의 편성에 구성된 부대가 없습니다.');
      return;
    }
    
    if (activeId && validTeams.some(t => t.id === activeId)) {
      setSelectedTeamId(activeId);
    } else {
      setSelectedTeamId(validTeams[0].id);
    }
    setIsImportModalOpen(true);
  };

  const confirmImport = () => {
    const { validTeams } = getRelevantTeams();
    const selectedTeam = validTeams.find(t => t.id === selectedTeamId);
    if (selectedTeam) {
      setParty({
        strikers: selectedTeam.strikers,
        specials: selectedTeam.specials
      });
    }
    setIsImportModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError('로그인이 필요합니다.');
      return;
    }
    if (!party || (party.strikers.every(s => s === null) && party.specials.every(s => s === null))) {
      setError('모의 편성에서 부대를 불러와주세요.');
      return;
    }
    if (!imageFile && !initialData) {
      setError('첨부 이미지를 반드시 첨부해야 합니다.');
      return;
    }

    setLoading(true);
    setError(null);

    const tagsArray = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => t.startsWith('#') ? t : `#${t}`);

    const payload = new FormData();
    payload.append('deckType', formData.deckType);
    payload.append('name', formData.name);
    payload.append('tactics', formData.tactics);
    payload.append('tags', JSON.stringify(tagsArray));
    payload.append('party', JSON.stringify(party));
    
    if (imageFile) {
      payload.append('image', imageFile);
    }
    const validYoutubeUrls = youtubeUrls.filter(v => v.url.trim().length > 0);
    if (validYoutubeUrls.length > 0) {
      payload.append('youtubeUrls', JSON.stringify(validYoutubeUrls));
    }

    try {
      if (initialData) {
        await api.put(`/pvp/parties/${initialData.id}`, payload);
        toast.success('수정되었습니다.');
        router.push(`/tactics/pvp/detail?code=${initialData.shortCode || initialData.id}`);
      } else {
        await api.post('/pvp/parties', payload);
        toast.success('성공적으로 공략이 등록되었습니다!');
        router.push('/tactics?mode=pvp');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || '업로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getStudent = (id: any) => {
    if (!id) return null;
    let found = null;
    if (typeof id === 'object') {
       found = masterData.find(s => String(s.id) === String(id.id)) || id;
    } else {
       found = masterData.find(s => String(s.id) === String(id)) || null;
    }
    return found;
  };

  const getSlotPortraitUrl = (student: any, type: 'striker' | 'special') => {
    if (student.portraitUrls?.length > 0) return student.portraitUrls[0];
    if (student.portraitUrl) return student.portraitUrl;
    if (student.portraiturl) return student.portraiturl;
    if (student.skills?.[0]?.portraitUrl) return student.skills[0].portraitUrl;
    return null;
  };

  const renderStudentIcon = (id: any, index: number, type: 'striker'|'special') => {
    const student = getStudent(id);
    const portraitUrl = student ? getSlotPortraitUrl(student, type) : null;
    
    return (
      <div 
        key={`${type}-${index}`} 
        className="w-12 h-12 rounded-full bg-white border border-pink-100 flex items-center justify-center overflow-hidden flex-shrink-0 relative shadow-sm"
      >
        {student && portraitUrl ? (
          <img src={getImageUrl(portraitUrl)} alt={student.name} className="w-full h-full object-cover scale-[1.3] pt-1.5" />
        ) : (
          <span className="text-[10px] text-gray-400">Empty</span>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 h-full overflow-y-auto">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-pink-300 transition-colors">
            <ArrowLeft size={28} strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">공략 작성하기 (PvP)</h1>
        </div>
        <button 
          type="button" 
          onClick={openImportModal}
          className="flex items-center gap-2 bg-pink-50 border border-pink-100 hover:border-pink-200 hover:bg-pink-100 text-pink-500 px-5 py-2.5 rounded-lg text-sm shadow-sm transition-all font-extrabold"
        >
          <Users size={18} />
          <span>모의 편성에서 불러오기</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur border border-pink-50 rounded-xl p-6 shadow-sm flex flex-col gap-6">
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-700">분류 (덱 타입)</label>
          <div className="flex gap-4">
            {[
              { id: 'Attack', label: '공격 덱' },
              { id: 'Defense', label: '방어 덱' }
            ].map(type => (
              <label key={type.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deckType"
                  value={type.id}
                  checked={formData.deckType === type.id}
                  onChange={handleChange}
                  className="w-4 h-4 text-pink-300 focus:ring-pink-200 border-pink-100 bg-white"
                />
                <span className="text-gray-700 font-medium text-sm">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <div className="p-4 bg-red-900/50 text-red-300 border border-red-700 rounded-lg">{error}</div>}

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">덱 이름 *</label>
            <input 
              required 
              type="text" 
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="예: 뉴츠키 공덱"
              className="w-full bg-white border border-pink-100 rounded-lg p-3 text-gray-800 focus:outline-none focus:border-pink-200 focus:ring-1 focus:ring-pink-200 transition-colors shadow-sm"
            />
          </div>
        </div>

        <div className="border-t border-pink-50 pt-6">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-bold text-gray-700">사용 덱 *</label>
          </div>

          {!party ? (
            <div className="p-8 border-2 border-dashed border-pink-100 bg-pink-50/50 rounded-xl text-center text-gray-500">
              우측 상단의 <b>불러오기 버튼</b>을 눌러 모의 편성에 구성된 덱을 가져오세요.
            </div>
          ) : (
            <div className="bg-white p-4 rounded-lg border border-pink-50 shadow-sm flex flex-col gap-3 relative">
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-gray-500 w-12 text-right">Striker</span>
                <div className="flex gap-2">{(party.strikers || [null, null, null, null]).map((id, idx) => renderStudentIcon(id, idx, 'striker'))}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-gray-500 w-12 text-right">Special</span>
                <div className="flex gap-2">{(party.specials || [null, null]).map((id, idx) => renderStudentIcon(id, idx, 'special'))}</div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-pink-100 pt-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">첨부 이미지 (필수) *</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-pink-200 rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-pink-300 transition-colors bg-pink-50/50 hover:bg-pink-50"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="max-h-[300px] object-contain rounded shadow-sm" />
              ) : (
                <>
                  <Upload size={32} className="text-pink-300" />
                  <span className="text-gray-500 font-medium">클릭하여 이미지 파일 첨부 (최대 10MB)</span>
                </>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-bold text-gray-700">유튜브 영상 링크 (선택, 최대 5개)</label>
              {youtubeUrls.length < 5 && (
                <button
                  type="button"
                  onClick={addYoutubeUrl}
                  className="text-xs font-bold text-pink-500 hover:text-pink-600 bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-lg transition-colors border border-pink-100 shadow-sm"
                >
                  + 링크 추가
                </button>
              )}
            </div>
            {youtubeUrls.map((video, idx) => {
              const videoId = extractYouTubeVideoId(video.url);
              return (
                <div key={idx} className="flex flex-col gap-2 p-4 border border-pink-100 rounded-xl bg-pink-50/30">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={video.url}
                      onChange={(e) => handleYoutubeUrlChange(idx, 'url', e.target.value)}
                      placeholder="유튜브 영상 링크 (예: https://youtu.be/...)"
                      className="flex-1 bg-white border border-pink-200 rounded-lg p-3 text-gray-800 focus:outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeYoutubeUrl(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors px-3 py-3 rounded-lg border border-transparent hover:border-red-100 hover:bg-red-50"
                      title="삭제"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  {video.url && !videoId && (
                    <div className="text-xs text-red-500 font-semibold px-1">올바른 유튜브 링크가 아닙니다.</div>
                  )}
                  {videoId && (
                    <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-pink-100 shadow-sm">
                      <div className="w-32 h-18 rounded overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200 relative pb-[18%]">
                        <img 
                          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} 
                          alt="Thumbnail preview" 
                          className="absolute inset-0 w-full h-full object-cover" 
                        />
                      </div>
                      <div className="flex flex-col justify-center gap-0.5 min-w-0 flex-1">
                        {video.title.trim() ? (
                          <span className="text-sm font-bold text-gray-800 line-clamp-2">{video.title}</span>
                        ) : (
                          <span className="text-sm font-semibold text-red-400 italic">⬆ 위에 영상 정보를 입력해주세요</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">조합 설명 *</label>
            <HtmlEditor 
              value={formData.tactics}
              onChange={(val) => setFormData(prev => ({ ...prev, tactics: val }))}
              placeholder="조합의 특징이나 대응법 등을 적어주세요."
              minHeight="200px"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">태그 (쉼표로 구분)</label>
            <input 
              type="text" 
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="예: 승률높음, 뉴츠키방덱"
              className="w-full bg-white border border-pink-200 rounded-lg p-3 text-gray-800 focus:outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300 shadow-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-pink-100">
          <button 
            type="submit" 
            disabled={loading}
            className="px-8 py-3 bg-pink-400 hover:bg-pink-300 text-white font-bold rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[150px] transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '공략 공유하기'}
          </button>
        </div>
      </form>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-pink-50 rounded-xl w-full max-w-sm flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-pink-50">
              <h2 className="text-lg font-bold text-gray-800">불러올 부대 선택</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-pink-300 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
              {getRelevantTeams().validTeams.map((team, idx) => (
                <label key={team.id} className="flex items-center gap-3 p-3 bg-white border border-pink-50 rounded-lg cursor-pointer hover:border-pink-100 hover:bg-pink-50/50 transition-colors shadow-sm">
                  <input 
                    type="radio" 
                    name="importTeam"
                    checked={selectedTeamId === team.id} 
                    onChange={() => setSelectedTeamId(team.id)}
                    className="w-4 h-4 text-pink-300 focus:ring-pink-200 bg-white border-pink-100"
                  />
                  <span className="text-gray-800 font-medium">{team.name || `${idx + 1}부대`}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-pink-50 flex justify-end gap-3 bg-gray-50/50 rounded-b-xl">
              <button 
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-gray-500 hover:text-gray-800 font-semibold transition-colors bg-white border border-gray-200 rounded hover:bg-gray-50 shadow-sm"
              >
                취소
              </button>
              <button 
                type="button"
                onClick={confirmImport}
                className="px-4 py-2 bg-pink-300 hover:bg-pink-400 text-white font-bold rounded shadow-sm transition-colors"
              >
                가져오기
              </button>
            </div>
          </div>
        </div>
      )}
      
      <iframe 
        src={exportUrl}
        style={{ display: 'none' }}
        onLoad={(e) => {
          const iframe = e.currentTarget;
          iframe.contentWindow?.postMessage({ type: 'GET_FORMATION_DATA' }, '*');
        }}
      />
    </div>
  );
}
