import React from 'react';
import type { RaidParty } from '@/types/raid';
import type { StudentMaster } from '@/types';
import { useFormationStore } from '@/store/formationStore';
import { useRouter } from 'next/navigation';

interface Props {
  party: RaidParty;
  masterData: StudentMaster[];
}

export function RaidPartyCard({ party, masterData }: Props) {
  const router = useRouter();
  const { importTeam } = useFormationStore();

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
        className="w-12 h-12 rounded-full bg-[#1C2532] border border-[#4A5568] flex items-center justify-center overflow-hidden flex-shrink-0 relative"
      >
        {student && student.portraitUrls?.[0] ? (
          <img 
            src={student.portraitUrls[0]} 
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
    <div className="bg-[#2D3748] rounded-lg p-4 flex flex-col gap-4 border border-[#4A5568]">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-white mb-2">{party.name}</h3>
          <div className="flex gap-2 mb-2">
            {party.tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded-full">
                {tag}
              </span>
            ))}
          </div>
          {party.clearTime && (
            <div className="text-sm text-gray-400">
              예상 클리어 타임: <span className="text-white">{party.clearTime}</span>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleOpenFormation}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded shadow-lg transition-all"
        >
          <span>✨ 모의 편성으로 열기</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 bg-[#1C2532] p-3 rounded">
        {party.parties.map((p, pIdx) => (
          <div key={pIdx} className="flex flex-col gap-2 border-b border-[#2D3748] last:border-0 pb-3 last:pb-0">
            {p.name && <div className="text-sm font-bold text-gray-300">{p.name}</div>}
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold text-gray-400 w-16">Striker</div>
              <div className="flex gap-2">
                {p.strikers.map((id, idx) => renderStudentIcon(id, idx, 'striker'))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold text-gray-400 w-16">Special</div>
              <div className="flex gap-2">
                {p.specials.map((id, idx) => renderStudentIcon(id, idx, 'special'))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {party.imagePath && (
        <div className="mt-2 rounded overflow-hidden max-h-64 border border-[#4A5568]">
          <img src={party.imagePath} alt="Clear verification" className="w-full object-cover" />
        </div>
      )}

      <div className="bg-[#1a202c] p-3 rounded text-sm text-gray-300">
        <span className="font-semibold text-gray-100">택틱 요약:</span> {party.tactics}
      </div>
    </div>
  );
}
