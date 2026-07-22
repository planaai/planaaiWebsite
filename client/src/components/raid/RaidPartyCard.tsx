import React from 'react';
import type { RaidParty } from '@/types/raid';
import type { StudentMaster } from '@/types';
import { useFormationStore } from '@/store/formationStore';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Trash2 } from 'lucide-react';
import { getImageUrl } from '../planner/utils';
import Link from 'next/link';

interface Props {
  party: RaidParty;
  masterData: StudentMaster[];
  onDelete?: () => void;
  isDetail?: boolean;
}

export function RaidPartyCard({ party, masterData, onDelete, isDetail = false }: Props) {
  const router = useRouter();
  const { importTeam } = useFormationStore();
  const { user } = useAuthStore();

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
