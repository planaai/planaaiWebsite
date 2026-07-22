import React, { useState } from 'react';
import { useFormationStore } from '@/store/formationStore';
import { Plus, Trash2, Edit2, Check } from 'lucide-react';

export function TeamTabs() {
  const { teams, activeTeamId, setActiveTeam, addTeam, removeTeam, updateTeamName, mode } = useFormationStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleEditStart = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleEditSave = (id: string) => {
    if (editName.trim()) {
      updateTeamName(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') handleEditSave(id);
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <div 
      className="absolute left-0 top-24 bottom-4 z-20 flex flex-col space-y-3 overflow-y-auto overflow-x-hidden pb-8 hide-scroll"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scroll::-webkit-scrollbar { display: none; }
      `}} />
      {teams.map((team) => {
        const isActive = team.id === activeTeamId;
        return (
          <div
            key={team.id}
            className={`group flex items-center relative transition-all duration-300 cursor-pointer ${
              isActive
                ? 'w-36 bg-[#2a4365] text-[#facc15]'
                : 'w-32 bg-white/90 text-slate-700 hover:w-36 hover:bg-white'
            } shadow-[4px_4px_10px_rgba(0,0,0,0.1)] rounded-r-lg`}
            onClick={() => {
              if (!editingId) setActiveTeam(team.id);
            }}
          >
            {editingId === team.id ? (
              <div className="flex items-center w-full p-3" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, team.id)}
                  onBlur={() => handleEditSave(team.id)}
                  className="flex-1 min-w-0 bg-white border border-[var(--plana-primary)] rounded px-2 py-1 text-sm outline-none text-black"
                />
                <button onClick={() => handleEditSave(team.id)} className="ml-1 text-green-600 hover:text-green-700">
                  <Check size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full p-4">
                <span className="font-bold text-lg truncate flex-1 skew-x-[-10deg]">{team.name}</span>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditStart(team.id, team.name); }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Edit2 size={14} />
                  </button>
                  {teams.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTeam(team.id); }}
                      className="p-1 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Active indicator bar */}
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#facc15]"></div>
            )}
          </div>
        );
      })}
      
      {/* 20 max teams */}
      {teams.length < 20 && (
        <button
          onClick={addTeam}
          className="w-32 bg-white/50 text-slate-600 hover:bg-white hover:w-36 transition-all duration-300 shadow-sm rounded-r-lg p-3 flex items-center justify-center space-x-2 shrink-0 mb-4"
        >
          <Plus size={18} />
          <span className="font-bold">부대 추가</span>
        </button>
      )}
    </div>
  );
}
