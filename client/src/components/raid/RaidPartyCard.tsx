import React from 'react';
import type { RaidParty } from '@/types/raid';
import type { StudentMaster } from '@/types';
import { useFormationStore } from '@/store/formationStore';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Trash2, ThumbsUp } from 'lucide-react';
import { getImageUrl } from '../planner/utils';
import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import TurnstileWidget from '@/components/TurnstileWidget';
import { api } from '@/lib/api';

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

  // Sync state if party prop changes
  useEffect(() => {
    setLikeCount(party.likeCount || 0);
    setIsLiked(party.isLiked || false);
  }, [party]);

  const canDelete = user && typeof party.id === 'number' && (user.role === 'ADMIN' || user.id === party.author?.id);

  const getStudent = (id: number | null) => {
    if (!id) return null;
    return masterData.find(s => s.id === id) || null;
  };

  const handleOpenFormation = () => {
    // Merge all parties into the formation store. (We'll just import the first party for now to keep it simple, or import multiple? The store currently replaces the active team, but can we import all? Let's just import the first party for now as an example)
    if (party.parties.length > 0) {
      importTeam(party.parties[0].strikers, party.parties[0].specials);
      router.push('/formation');
    }
  };

  const handleLike = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }
    if (isLiking) return;

    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;

    try {
      setIsLiking(true);
      // Use Turnstile token
      const token = turnstileToken;
      if (!token) {
        alert('보안 인증이 갱신되었습니다. 좋아요 버튼을 다시 눌러주세요.');
        setIsLiking(false);
        turnstileRef.current?.reset();
        return;
      }
      
      turnstileRef.current?.reset();
      setTurnstileToken(null);

      // Optimistic update
      setIsLiked(!originalIsLiked);
      setLikeCount(originalIsLiked ? Math.max(0, originalLikeCount - 1) : originalLikeCount + 1);

      const res = await api.post(`/raids/parties/${party.id}/like`, { turnstileToken: token });
      
      if (!res.data.success) {
        // Revert on failure
        setIsLiked(originalIsLiked);
        setLikeCount(originalLikeCount);
        alert('추천 처리 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || '추천 처리 중 오류가 발생했습니다.');
      // Revert on failure
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
        className="w-12 h-12 rounded-full bg-white border border-purple-200 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 relative"
      >
        {student && student.portraitUrls?.[0] ? (
          <img 
            src={getImageUrl(student.portraitUrls[0])} 
            alt={student.name} 
            className="w-full h-full object-cover scale-[1.3] pt-2"
          />
        ) : (
          <span className="text-xs text-gray-500">Empty</span>
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

  return (
    <div className="bg-white/90 backdrop-blur rounded-lg p-4 flex flex-col gap-4 border border-purple-100 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold text-gray-800">{party.name}</h3>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded border border-gray-200">
              Code: {party.shortCode || party.id}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-2 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold rounded">
              {getModeName(party.mode)}
            </span>
            <span className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded">
              {bossName || party.bossId}
            </span>
            <span className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded">
              {getTerrainName(party.terrain)}
            </span>
            <span className="px-2 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold rounded">
              {party.difficulty}
            </span>
          </div>

          <div className="flex gap-2 mb-2">
            {party.tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-600 text-xs rounded-full">
                {tag}
              </span>
            ))}
          </div>
          {party.clearTime && (
            <div className="text-sm text-gray-500">
              예상 클리어 타임: <span className="text-gray-800 font-semibold">{party.clearTime}</span>
            </div>
          )}
          <div className="text-sm text-gray-500 mt-1">
            작성자: <span className="text-gray-800 font-semibold">{party.author?.nickname || party.author?.username || '시스템'}</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLike}
              disabled={isLiking}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${isLiked ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              title="추천하기"
            >
              <ThumbsUp size={16} className={isLiked ? 'fill-blue-500 text-blue-500' : ''} />
              <span className="text-sm font-bold">{likeCount}</span>
            </button>
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
              className="flex items-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded shadow-sm transition-all text-sm font-bold"
            >
              상세 보기
            </Link>
          )}
          {isDetail && (
            <button 
              onClick={handleOpenFormation}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded shadow-lg transition-all"
            >
              <span>✨ 모의 편성으로 열기</span>
            </button>
          )}
          {canDelete && onDelete && (
            <button 
              onClick={onDelete}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={14} />
              <span>삭제</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-gray-50/80 p-3 rounded border border-gray-100">
        {party.parties.map((p, pIdx) => (
          <div key={pIdx} className="flex flex-col gap-2 border-b border-gray-200 last:border-0 pb-3 last:pb-0">
            {p.name && <div className="text-sm font-bold text-gray-700">{p.name}</div>}
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold text-gray-600 w-16">Striker</div>
              <div className="flex gap-2">
                {p.strikers.map((id, idx) => renderStudentIcon(id, idx, 'striker'))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold text-gray-600 w-16">Special</div>
              <div className="flex gap-2">
                {p.specials.map((id, idx) => renderStudentIcon(id, idx, 'special'))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isDetail && party.imagePath && (
        <div className="mt-2 rounded overflow-hidden max-h-64 border border-gray-200 shadow-sm">
          <img src={getImageUrl(party.imagePath)} alt="Clear verification" className="w-full object-cover" />
        </div>
      )}

      {isDetail && (
        <div className="bg-gray-50/80 p-3 rounded text-sm text-gray-600 border border-gray-100">
          <span className="font-semibold text-gray-800">택틱 요약:</span> {party.tactics}
        </div>
      )}
    </div>
  );
}
