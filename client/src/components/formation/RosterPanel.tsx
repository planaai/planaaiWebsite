import React, { useState, useMemo } from 'react';
import { Search, Filter, CheckCircle } from 'lucide-react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { useArchiveStore } from '@/store/archiveStore';
import { useFormationStore } from '@/store/formationStore';

interface Props {
  masterData: StudentMaster[];
  schema: SchemaConfig | null;
}

export function RosterPanel({ masterData, schema }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterFieldType, setFilterFieldType] = useState('');
  const [filterAttackType, setFilterAttackType] = useState('');
  const [filterArmorType, setFilterArmorType] = useState('');

  const records = useArchiveStore(state => state.records);
  const { rosterType, mode, teams, assignStudent, removeStudent } = useFormationStore();

  const getLabel = (type: string, key: string) => {
    return schema?.enums[type]?.values?.find(v => v.key === key)?.label || key;
  };

  // Check if a student is already assigned to any team
  const getAssignedTeamIds = (studentId: number): string[] => {
    const assignedIds: string[] = [];
    teams.forEach(t => {
      if (t.strikers.includes(studentId) || t.specials.includes(studentId)) {
        assignedIds.push(t.id);
      }
    });
    return assignedIds;
  };

  const filteredData = useMemo(() => {
    return masterData.filter(master => {
      const isOwned = !!records[master.id];
      if (rosterType === 'collection' && !isOwned) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!master.name.toLowerCase().includes(q) && !master.studentNumber?.toString().includes(q)) {
          return false;
        }
      }
      
      if (filterSchool && master.school !== filterSchool) return false;
      if (filterRole && master.Role !== filterRole) return false;
      if (filterFieldType && master.fieldType !== filterFieldType) return false;
      if (filterAttackType && master.attackType !== filterAttackType) return false;
      if (filterArmorType && master.armorType !== filterArmorType) return false;
      
      return true;
    });
  }, [masterData, records, searchQuery, filterSchool, filterRole, filterFieldType, filterAttackType, filterArmorType, rosterType]);

  const handleDragStart = (e: React.DragEvent, studentId: number, fieldType: string) => {
    // We normalize field type to 'striker' or 'special'
    const normalizedType = fieldType.toLowerCase();
    e.dataTransfer.setData('application/json', JSON.stringify({ studentId, type: normalizedType }));
  };

  const handleStudentClick = (studentId: number, fieldType: string) => {
    const normalizedType = fieldType.toLowerCase() as 'striker' | 'special';

    // Auto-fill the first available empty slot of the correct type in the active team
    const activeTeam = teams.find(t => t.id === useFormationStore.getState().activeTeamId);
    if (!activeTeam) return;

    const slotArray = normalizedType === 'striker' ? activeTeam.strikers : activeTeam.specials;
    const firstEmptyIndex = slotArray.findIndex(id => id === null);

    if (firstEmptyIndex !== -1) {
      assignStudent(activeTeam.id, normalizedType, firstEmptyIndex, studentId);
    } else {
      console.warn(`No empty ${normalizedType} slot available`);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <div className="p-4 border-b border-[var(--plana-border)] bg-transparent space-y-3 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="학생 이름 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--plana-primary)] outline-none transition-shadow"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <select value={filterFieldType} onChange={e => setFilterFieldType(e.target.value)} className="bg-slate-100 border-none rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--plana-primary)] cursor-pointer">
            <option value="">분류 (전체)</option>
            {schema?.enums.FieldType?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>) || (
              <><option value="Striker">스트라이커</option><option value="Special">스페셜</option></>
            )}
          </select>
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className="bg-slate-100 border-none rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--plana-primary)] cursor-pointer">
            <option value="">학교 (전체)</option>
            {schema?.enums.School?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-slate-100 border-none rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--plana-primary)] cursor-pointer">
            <option value="">역할 (전체)</option>
            {schema?.enums.Role?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
          <select value={filterAttackType} onChange={e => setFilterAttackType(e.target.value)} className="bg-slate-100 border-none rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--plana-primary)] cursor-pointer">
            <option value="">공격타입 (전체)</option>
            {schema?.enums.AttackType?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
          <select value={filterArmorType} onChange={e => setFilterArmorType(e.target.value)} className="col-span-2 bg-slate-100 border-none rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--plana-primary)] cursor-pointer">
            <option value="">방어타입 (전체)</option>
            {schema?.enums.ArmorType?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 content-start">
        <div className="grid grid-cols-4 gap-2">
          {filteredData.map(master => {
            const isOwned = !!records[master.id];
            const assignedTeams = getAssignedTeamIds(master.id);
            const isAssigned = assignedTeams.length > 0;
            // In raid mode, if assigned to any team, can't be used (or visually grayed out, though they can re-assign which moves them)
            const isAssignedElsewhereRaid = mode === 'raid' && isAssigned;
            const normalizedType = master.fieldType.toLowerCase();

            return (
              <div 
                key={master.id}
                draggable
                onDragStart={(e) => handleDragStart(e, master.id, master.fieldType)}
                onClick={() => handleStudentClick(master.id, master.fieldType)}
                className={`relative aspect-square rounded-md overflow-hidden cursor-pointer group`}
              >
                {master.portraitUrl ? (
                  <img 
                    src={master.portraitUrl} 
                    alt={master.name} 
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xl">
                    {master.name.charAt(0)}
                  </div>
                )}
                
                {/* Field Type Indicator */}
                <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${master.fieldType === 'Striker' ? 'bg-[#D33F4A]' : 'bg-[#315B9A]'}`} />
                
                {/* Assigned Status Overlay */}
                {isAssigned && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                    <CheckCircle className="text-green-400 mb-1" size={18} />
                    {mode === 'raid' && (
                      <span className="text-[10px] text-white font-bold bg-black/60 px-1 rounded truncate max-w-[90%]">
                        {teams.find(t => t.id === assignedTeams[0])?.name}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Hover Info */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-xs text-white font-bold text-center px-1 break-words line-clamp-2">
                    {master.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        {filteredData.length === 0 && (
          <div className="text-center text-slate-400 mt-10">
            조건에 맞는 학생이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
