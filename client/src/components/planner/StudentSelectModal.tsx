import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { StudentMaster } from '@/types';
import { getImageUrl } from './utils';

interface StudentSelectModalProps {
  masterData: StudentMaster[];
  archiveData: any[];
  plans: any[];
  onSelect: (studentId: number, archive: any) => void;
  onClose: () => void;
}

export function StudentSelectModal({ masterData, archiveData, plans, onSelect, onClose }: StudentSelectModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredArchive = archiveData.filter(archive => {
    const master = masterData.find(m => m.id === archive.studentId);
    if (!master) return false;
    if (searchTerm && !master.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white/95 rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold text-slate-800">육성할 학생 선택</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-[var(--plana-primary)] hover:bg-pink-50 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="학생 이름 검색..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[var(--plana-primary)] transition-colors shadow-sm"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
          {filteredArchive.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-bold">
              해당하는 학생이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {filteredArchive.map((archive) => {
                const master = masterData.find(m => m.id === archive.studentId);
                if (!master) return null;
                
                const hasPlan = plans.some(p => p.studentId === master.id);
                
                return (
                  <button 
                    key={master.id} 
                    disabled={hasPlan}
                    onClick={() => {
                      onSelect(master.id, archive);
                      onClose();
                    }}
                    className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                      hasPlan 
                        ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' 
                        : 'bg-white border-slate-200 hover:border-pink-300 hover:bg-pink-50 hover:-translate-y-1 hover:shadow-lg hover:shadow-pink-500/20 shadow-sm'
                    }`}
                  >
                    <div className="relative mb-2">
                      {master.portraitUrls && master.portraitUrls.length > 0 ? (
                        <img 
                          src={getImageUrl(master.portraitUrls[0])} 
                          alt={master.name} 
                          className={`w-16 h-16 object-cover rounded-full bg-white ring-2 ${hasPlan ? 'ring-slate-200' : 'ring-pink-300'}`} 
                        />
                      ) : (
                        <div className={`w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400 ring-2 ${hasPlan ? 'ring-slate-200' : 'ring-pink-300'}`}>No Img</div>
                      )}
                    </div>
                    
                    <span className="text-sm font-bold text-slate-700 truncate w-full text-center">{master.name}</span>
                    
                    {hasPlan ? (
                      <span className="mt-1 text-[10px] text-slate-400 font-bold">등록됨</span>
                    ) : (
                      <span className="mt-1 text-[10px] text-[var(--plana-primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">클릭하여 추가</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
