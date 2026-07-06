import React, { useState, useMemo } from 'react';
import { Search, Filter, CheckCircle, User } from 'lucide-react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { useArchiveStore } from '@/store/archiveStore';
import { useFormationStore } from '@/store/formationStore';
import { useAlert } from '@/contexts/AlertContext';
import { getImageUrl } from '@/components/planner/utils';

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
  const { rosterType, mode, teams, activeTeamId, assignStudent, removeStudent } = useFormationStore();
  const { showConfirm } = useAlert();

  const [sortingTeamsSnapshot, setSortingTeamsSnapshot] = useState(teams);

  // Update sorting snapshot only when filters or active team changes, not when assigning
  React.useEffect(() => {
    setSortingTeamsSnapshot(teams);
  }, [activeTeamId, searchQuery, filterSchool, filterRole, filterFieldType, filterAttackType, filterArmorType, rosterType, mode]);

  const getLabel = (type: string, key: string) => {
    return schema?.enums[type]?.values?.find(v => v.key === key)?.label || key;
  };

  // Check if a student is already assigned to any team (Live data for overlay)
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
    const filtered = masterData.filter(master => {
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

    // Sort assigned students to the top using the snapshot
    filtered.sort((a, b) => {
      const aTeamIndex = sortingTeamsSnapshot.findIndex(t => t.strikers.includes(a.id) || t.specials.includes(a.id));
      const bTeamIndex = sortingTeamsSnapshot.findIndex(t => t.strikers.includes(b.id) || t.specials.includes(b.id));
      
      const aAssigned = aTeamIndex !== -1;
      const bAssigned = bTeamIndex !== -1;

      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      
      if (aAssigned && bAssigned) {
        // Active team students first, then sort by team index
        const aIsActive = aTeamIndex === sortingTeamsSnapshot.findIndex(t => t.id === activeTeamId);
        const bIsActive = bTeamIndex === sortingTeamsSnapshot.findIndex(t => t.id === activeTeamId);
        
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        
        return aTeamIndex - bTeamIndex;
      }
      
      return 0;
    });

    return filtered;
  }, [masterData, records, searchQuery, filterSchool, filterRole, filterFieldType, filterAttackType, filterArmorType, rosterType, mode, sortingTeamsSnapshot]);

  const handleDragStart = (e: React.DragEvent, studentId: number, fieldType: string) => {
    // We normalize field type to 'striker' or 'special'
    const normalizedType = fieldType.toLowerCase();
    e.dataTransfer.setData('application/json', JSON.stringify({ studentId, type: normalizedType }));
  };

  const handleStudentClick = (studentId: number, fieldType: string) => {
    const normalizedType = fieldType.toLowerCase() as 'striker' | 'special';

    const activeTeam = teams.find(t => t.id === useFormationStore.getState().activeTeamId);
    if (!activeTeam) return;

    const slotArray = normalizedType === 'striker' ? activeTeam.strikers : activeTeam.specials;
    
    // Check if the student is already in the active team
    const currentSlotIndex = slotArray.findIndex(id => id === studentId);
    if (currentSlotIndex !== -1) {
      // If already assigned to this team, remove them
      removeStudent(activeTeam.id, normalizedType, currentSlotIndex);
      return;
    }

    // Auto-fill logic
    const doAssign = () => {
      const firstEmptyIndex = slotArray.findIndex(id => id === null);
      if (firstEmptyIndex !== -1) {
        assignStudent(activeTeam.id, normalizedType, firstEmptyIndex, studentId);
      } else {
        console.warn(`No empty ${normalizedType} slot available`);
      }
    };

    const assignedTeams = getAssignedTeamIds(studentId);
    if (mode === 'raid' && assignedTeams.length > 0) {
      const existingTeam = teams.find(t => t.id === assignedTeams[0]);
      if (existingTeam) {
        showConfirm(
          '편성 확인',
          `이 학생은 ${existingTeam.name}에 이미 편성되어 있습니다. 확인을 누르시면 기존 부대에서 제외되어 현재 부대로 옮겨집니다.`,
          doAssign
        );
        return;
      }
    }

    doAssign();
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
            const isAssignedToActive = assignedTeams.includes(activeTeamId);
            const isAssigned = mode === 'raid' ? assignedTeams.length > 0 : isAssignedToActive;
            const normalizedType = master.fieldType.toLowerCase();

            return (
              <div 
                key={master.id}
                draggable
                onDragStart={(e) => handleDragStart(e, master.id, master.fieldType)}
                onClick={() => handleStudentClick(master.id, master.fieldType)}
                className={`relative aspect-square rounded-md overflow-hidden cursor-pointer group bg-slate-100`}
              >
                {master.portraitUrls && master.portraitUrls.length > 0 ? (
                  <img 
                    src={getImageUrl(master.portraitUrls[0])} 
                    alt={master.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[var(--plana-primary)] transition-colors">
                    <User size={32} strokeWidth={1.5} />
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
