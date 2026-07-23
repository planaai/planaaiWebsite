import React, { useRef, useState, useEffect } from 'react';
import type { RaidParty } from '@/types/raid';
import type { StudentMaster } from '@/types';
import { useFormationStore } from '@/store/formationStore';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Trash2, ThumbsUp, ChevronRight, FileText, MonitorPlay, Image as ImageIcon, Pencil } from 'lucide-react';
import { getImageUrl } from '../planner/utils';
import Link from 'next/link';
import TurnstileWidget from '@/components/TurnstileWidget';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[3] : null;
}

interface Props {
  party: RaidParty;
  masterData: StudentMaster[];
  onDelete?: () => void;
  isDetail?: boolean;
  bossName?: string;
}

export function RaidPartyCard({ party, masterData, onDelete, isDetail = false, bossName }: Props) {
  const router = useRouter();
  const { importTeam } = useFormationStore();
  const { user } = useAuthStore();
  
  const [likeCount, setLikeCount] = useState(party.likeCount || 0);
  const [isLiked, setIsLiked] = useState(party.isLiked || false);
  const turnstileRef = useRef<any>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [currentPartyIndex, setCurrentPartyIndex] = useState(0);

  // Sync state if party prop changes
  useEffect(() => {
    setLikeCount(party.likeCount || 0);
    setIsLiked(party.isLiked || false);
  }, [party]);

  // Slideshow for non-detail view
  useEffect(() => {
    if (isDetail || party.parties.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentPartyIndex(prev => (prev + 1) % party.parties.length);
    }, 3500);
    
    return () => clearInterval(interval);
  }, [isDetail, party.parties.length]);

  const canDelete = user && typeof party.id === 'number' && (user.role === 'ADMIN' || user.id === party.author?.id);

  const getStudent = (id: number | null) => {
    if (!id) return null;
    return masterData.find(s => s.id === id) || null;
  };

  const handleOpenFormation = () => {
    if (party.parties.length > 0) {
      importTeam(party.parties[0].strikers, party.parties[0].specials);
      router.push('/formation');
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      router.push('/login');
      return;
    }
    if (isLiking) return;

    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;

    try {
      setIsLiking(true);
      
      let token = null;
      if (!isLiked) {
        token = turnstileToken;
        if (!token) {
          toast.info('잠시 후에 다시 시도해 주세요.');
          setIsLiking(false);
          turnstileRef.current?.reset();
          return;
        }
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      }

      setIsLiked(!originalIsLiked);
      setLikeCount(originalIsLiked ? Math.max(0, originalLikeCount - 1) : originalLikeCount + 1);

      const res = await api.post(`/raids/parties/${party.id}/like`, { turnstileToken: token });
      
      if (!res.data.success) {
        setIsLiked(originalIsLiked);
        setLikeCount(originalLikeCount);
        toast.error('추천 처리 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || '추천 처리 중 오류가 발생했습니다.');
      setIsLiked(originalIsLiked);
      setLikeCount(originalLikeCount);
    } finally {
      setIsLiking(false);
    }
  };

  const renderStudentIcon = (id: number | null, index: number, type: 'striker'|'special') => {
    const student = getStudent(id);
    return (
      <div 
        key={`${type}-${index}`} 
        className="w-[3.25rem] h-[3.25rem] rounded-lg bg-slate-100 border border-gray-200/50 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 relative"
      >
        {student && student.portraitUrls?.[0] ? (
          <img 
            src={getImageUrl(student.portraitUrls[0])} 
            alt={student.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-gray-400 font-medium">Empty</span>
        )}
      </div>
    );
  };

  const getTerrainName = (t?: string) => {
    if (t === 'Urban') return '시가전';
    if (t === 'Outdoor') return '야전';
    if (t === 'Indoor') return '실내전';
    return t || '알 수 없음';
  };

  const getModeName = (m?: string) => {
    if (m === 'TotalAssault') return '총력전';
    if (m === 'GrandAssault') return '대결전';
    if (m === 'LimitBreakAssault') return '제약해제결전';
    return m || '알 수 없음';
  };

  const renderPartyView = (p: any, pIdx: number) => (
    <div className={`flex flex-col gap-2.5 ${isDetail ? 'bg-white p-4 rounded-xl border border-pink-50 shadow-sm h-full' : 'p-1 overflow-hidden'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="px-2 py-0.5 bg-gray-800 text-white text-[10px] font-extrabold rounded-md shadow-sm">
          {pIdx + 1}부대
        </span>
        {p.name && <span className="text-sm font-bold text-gray-700">{p.name}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex text-[11px] font-black -skew-x-[15deg] w-[4.75rem] shrink-0">
          <div className="px-2 py-1 text-white shadow-sm tracking-wider flex items-center justify-center bg-[#D33F4A] w-full">
            <div className="skew-x-[15deg]">STRIKER</div>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex gap-1.5 shrink-0 [&::-webkit-scrollbar]:hidden">
            {p.strikers.map((id: number | null, idx: number) => renderStudentIcon(id, idx, 'striker'))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex text-[11px] font-black -skew-x-[15deg] w-[4.75rem] shrink-0">
          <div className="px-2 py-1 text-white shadow-sm tracking-wider flex items-center justify-center bg-[#315B9A] w-full">
            <div className="skew-x-[15deg]">SPECIAL</div>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex gap-1.5 shrink-0 [&::-webkit-scrollbar]:hidden">
            {p.specials.map((id: number | null, idx: number) => renderStudentIcon(id, idx, 'special'))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={
      isDetail
        ? "bg-white rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm border border-gray-200"
        : "bg-white rounded-xl p-5 flex flex-col gap-4 border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 group"
    }>
      {/* Header Area */}
      <div className={`flex justify-between items-start ${isDetail ? 'border-b border-gray-100 pb-5 mb-2' : ''}`}>
        <div className={`flex flex-col ${isDetail ? 'gap-3' : 'gap-1.5'} w-full pr-4`}>
          <div className="flex items-center gap-2">
            <h3 className={`${isDetail ? 'text-2xl md:text-3xl font-black text-gray-900 tracking-tight' : 'text-xl font-extrabold text-gray-900 tracking-tight group-hover:text-pink-500 transition-colors'}`}>
              {party.name}
            </h3>
          </div>
          
          <div className={`flex items-center flex-wrap gap-2 ${isDetail ? 'text-sm text-gray-500' : 'text-xs text-gray-500 font-medium mb-1'}`}>
            <span className={`${isDetail ? 'bg-gray-100 px-2 py-1 text-gray-700' : 'bg-gray-100 px-1.5 py-0.5 text-gray-600'} rounded font-mono font-bold`}>
              #{party.shortCode || party.id}
            </span>
            <span className="text-gray-300">|</span>
            <span>작성자: <span className="text-gray-700 font-bold">{party.author?.nickname || party.author?.username || '시스템'}</span></span>
            {party.clearTime && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-pink-500 font-bold bg-pink-50 px-2 py-0.5 rounded">⏱ {party.clearTime}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 bg-pink-50 text-pink-500 border border-pink-100 text-[11px] font-bold rounded shadow-sm">
              {getModeName(party.mode)}
            </span>
            <span className="px-2 py-0.5 bg-pink-50/50 text-pink-400 border border-pink-100/50 text-[11px] font-bold rounded shadow-sm">
              {bossName || party.bossId}
            </span>
            <span className="px-2 py-0.5 bg-white text-pink-400 border border-pink-100/50 text-[11px] font-bold rounded shadow-sm">
              {getTerrainName(party.terrain)}
            </span>
            <span className="px-2 py-0.5 bg-white text-pink-300 border border-pink-100/50 text-[11px] font-bold rounded shadow-sm">
              {party.difficulty}
            </span>
            {party.tags.length > 0 && <div className="w-[1px] h-3 bg-pink-200 mx-1"></div>}
            {party.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[11px] font-semibold rounded-full border border-gray-200 shadow-sm">
                #{tag}
              </span>
            ))}
            {party.youtubeUrls && party.youtubeUrls.length > 0 && (
              <span className="px-2 py-0.5 bg-red-50 text-red-500 border border-red-100 text-[11px] font-bold rounded shadow-sm flex items-center gap-1">
                🎬 영상 {party.youtubeUrls.length > 1 ? party.youtubeUrls.length : ''}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-2 items-end flex-shrink-0">
          <div className="flex items-center gap-2">
            {isDetail ? (
              <button 
                onClick={handleLike}
                disabled={isLiking}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shadow-sm ${isLiked ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'}`}
                title="추천하기"
              >
                <ThumbsUp size={16} className={isLiked ? 'fill-blue-500 text-blue-500' : ''} />
                <span className="text-sm font-extrabold">{likeCount}</span>
              </button>
            ) : (
              <div 
                className={`flex items-center gap-1.5 ${isLiked ? 'text-blue-600' : 'text-gray-500'}`}
                title="추천 수"
              >
                <ThumbsUp size={16} className={isLiked ? 'fill-blue-500 text-blue-500' : ''} />
                <span className="text-sm font-extrabold">{likeCount}</span>
              </div>
            )}
            <TurnstileWidget
              ref={turnstileRef}
              size="invisible"
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
            />
          </div>

          {!isDetail && (
            <Link 
              href={`/raids/${party.shortCode || party.id}`}
              className="flex items-center gap-1 bg-pink-50 hover:bg-pink-100 text-pink-500 px-3 py-1.5 rounded-full border border-pink-100 shadow-sm transition-all text-xs font-bold mt-1"
            >
              상세 보기 <ChevronRight size={14} />
            </Link>
          )}

          {isDetail && (
            <button 
              onClick={handleOpenFormation}
              className="flex items-center gap-1.5 bg-pink-50 hover:bg-pink-100 border border-pink-100 text-pink-500 px-3 py-1.5 rounded-full shadow-sm transition-all font-bold text-xs mt-1"
            >
              <span>모의편성으로 가져오기</span>
            </button>
          )}
        </div>
      </div>

      {/* Party Render Area */}
      <div className={`mt-2 ${!isDetail ? 'bg-gray-50/50 rounded-xl p-3 border border-gray-100/80 relative overflow-hidden h-[180px]' : 'bg-gray-50/80 rounded-xl p-5 border border-gray-100 shadow-inner'}`}>
        {isDetail ? (
          <div className="flex flex-col gap-4">
            {party.parties.map((p, pIdx) => (
              <React.Fragment key={pIdx}>
                {renderPartyView(p, pIdx)}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <>
            {party.parties.map((p, pIdx) => (
              <div
                key={pIdx}
                className={`absolute inset-0 p-3 transition-opacity duration-700 ease-in-out ${
                  pIdx === currentPartyIndex ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {renderPartyView(p, pIdx)}
              </div>
            ))}
            {party.parties.length > 1 && (
              <div className="absolute bottom-2 right-4 z-20 flex gap-1.5 bg-white/80 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm border border-gray-200/50">
                {party.parties.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentPartyIndex ? 'w-4 bg-pink-300' : 'w-1.5 bg-gray-300'}`} 
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer / Actions */}
      {isDetail && (
        <div className="flex flex-col gap-4 mt-2">
          {party.tactics && (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-sm text-gray-700 leading-relaxed shadow-sm">
              <div className="font-extrabold text-gray-900 mb-3 flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-pink-100 text-pink-500 shadow-sm border border-pink-200">
                  <FileText size={16} />
                </div>
                택틱 요약
              </div>
              <div className="whitespace-pre-wrap">{party.tactics}</div>
            </div>
          )}

          {party.imagePath && (
            <div className="flex flex-col gap-4 mt-2">
              <div className="font-extrabold text-gray-900 flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-500 shadow-sm border border-indigo-200">
                  <ImageIcon size={16} />
                </div>
                첨부 이미지
              </div>
              <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] bg-gray-50 flex justify-center max-h-[400px] p-2">
                <img src={getImageUrl(party.imagePath)} alt="Attached image" className="w-full object-contain max-h-[380px] rounded-xl" />
              </div>
            </div>
          )}

          {party.youtubeUrls && party.youtubeUrls.length > 0 && (
            <div className="flex flex-col gap-4 mt-4">
              <div className="font-extrabold text-gray-900 flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-100 text-red-500 shadow-sm border border-red-200">
                  <MonitorPlay size={16} />
                </div>
                공략 영상
              </div>
              <div className="grid grid-cols-1 gap-8">
                {party.youtubeUrls.map((videoData, idx) => {
                  const url = typeof videoData === 'string' ? videoData : videoData.url;
                  const title = typeof videoData === 'string' ? null : videoData.title;
                  const channel = typeof videoData === 'string' ? null : videoData.channel;
                  
                  const videoId = extractYouTubeVideoId(url);
                  if (!videoId) return null;
                  return (
                    <div key={idx} className="flex flex-col gap-3">
                      <div className="rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 relative pb-[56.25%] h-0 bg-black group transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.15)]">
                        <iframe
                          className="absolute top-0 left-0 w-full h-full"
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title={`YouTube video player ${idx + 1}`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      {(title || channel) && (
                        <div className="flex flex-col px-1">
                          {title && <span className="font-bold text-gray-800 text-[16px] leading-tight line-clamp-2">{title}</span>}
                          {channel && <span className="text-[14px] text-gray-500 font-medium mt-1">{channel}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            {canDelete && onDelete ? (
              <div className="flex items-center gap-2">
                <Link 
                  href={`/raids/edit/${party.shortCode || party.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-bold"
                >
                  <Pencil size={16} />
                  <span>공략 수정</span>
                </Link>
                <button 
                  onClick={onDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold"
                >
                  <Trash2 size={16} />
                  <span>공략 삭제</span>
                </button>
              </div>
            ) : <div />}
          </div>
        </div>
      )}
    </div>
  );
}
