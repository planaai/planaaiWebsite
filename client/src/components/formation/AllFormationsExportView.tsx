import React, { forwardRef } from 'react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { useFormationStore } from '@/store/formationStore';
import { useAuthStore } from '@/store/authStore';
import { getImageUrl } from '@/components/planner/utils';

interface Props {
  masterData: StudentMaster[];
  schema: SchemaConfig | null;
}

export const AllFormationsExportView = forwardRef<HTMLDivElement, Props>(({ masterData, schema }, ref) => {
  const { teams } = useFormationStore();
  const { user } = useAuthStore();
  
  const getStudent = (id: number | null) => {
    if (!id) return null;
    return masterData.find(s => s.id === id) || null;
  };

  const getAttackColor = (type: string) => {
    switch(type) {
      case 'Explosion': return 'bg-[#D33F4A]';
      case 'Pierce': return 'bg-[#E09F36]';
      case 'Mystic': return 'bg-[#315B9A]';
      case 'Vibration': return 'bg-[#8B5FBF]';
      case 'Decomposition': return 'bg-[#1ABC9C]';
      default: return 'bg-slate-500';
    }
  };

  const getArmorColor = (type: string) => {
    switch(type) {
      case 'LightArmor': return 'bg-[#D33F4A]';
      case 'HeavyArmor': return 'bg-[#E09F36]';
      case 'MysticArmor':
      case 'Unarmed': return 'bg-[#315B9A]';
      case 'ElasticArmor': return 'bg-[#8B5FBF]';
      case 'CompositeArmor': return 'bg-[#1ABC9C]';
      default: return 'bg-slate-500';
    }
  };

  const getSlotPortraitIconUrl = (student: StudentMaster) => {
    if (student.portraitUrls && student.portraitUrls.length > 0 && student.portraitUrls[0]) {
      return student.portraitUrls[0];
    }
    return null;
  };

  const activeTeams = teams.filter(t => t.strikers.length > 0 || t.specials.length > 0);
  
  if (activeTeams.length === 0) return null;

  return (
    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
      <div
        ref={ref}
        className="w-fit min-w-[750px] pr-10 flex flex-col overflow-hidden bg-white text-[var(--plana-text-main)] font-sans pb-10 shadow-2xl relative"
      >
      {/* Background Image */}
      <img 
        src={`${window.location.origin}/images/ui/plana_bg.jpg`} 
        alt="background" 
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" 
      />
      
      {/* Header Spacer */}
      <div className="relative z-10 w-full pt-8"></div>

      <div className="relative z-10 flex-1 flex flex-col w-full px-10 gap-6">
        {activeTeams.map((team, index) => (
          <div key={team.id} className="bg-white/85 backdrop-blur-md rounded-xl p-6 shadow-lg border border-slate-200 flex flex-col gap-4">
            
            <div className="flex items-center gap-3 w-full">
              <div className="bg-[#2B3A55] text-white font-bold text-lg px-4 py-1.5 rounded-md truncate max-w-[400px]">
                {team.name}
              </div>
            </div>

            <div className="flex w-fit gap-8">
              {/* Strikers */}
              <div className="flex-none flex flex-col gap-2">
                <div className="text-sm font-bold text-slate-500 border-b border-slate-300 pb-1">STRIKER</div>
                <div className="flex gap-3 mt-1">
                  {team.strikers.map((studentId, sIdx) => {
                    const student = getStudent(studentId);
                    if (!student) {
                      return (
                         <div key={`empty-s-${sIdx}`} className="flex flex-col items-center gap-1 w-[80px]">
                           <div className="relative w-[80px] h-[80px] rounded-lg bg-slate-200/50 border-b-4 border-slate-300 flex items-center justify-center opacity-80 overflow-hidden shrink-0">
                              <img src={`${window.location.origin}/images/ui/equip_empty.png`} className="w-1/2 h-1/2 object-contain opacity-50" alt="empty" />
                           </div>
                           <div className="text-[11px] font-bold text-slate-400 text-center truncate w-full px-1">EMPTY</div>
                         </div>
                      );
                    }
                    const iconUrl = getSlotPortraitIconUrl(student);
                    return (
                      <div key={`s-${sIdx}`} className="flex flex-col items-center gap-1 w-[80px]">
                        <div className="relative w-[80px] h-[80px] rounded-lg bg-slate-100 shadow-md border-b-4 overflow-hidden shrink-0" style={{ borderColor: student ? (student.attackType === 'Explosion' ? '#D33F4A' : student.attackType === 'Pierce' ? '#E09F36' : student.attackType === 'Mystic' ? '#315B9A' : student.attackType === 'Vibration' ? '#8B5FBF' : '#1ABC9C') : '#cbd5e1' }}>
                          {iconUrl && <img src={getImageUrl(iconUrl)} alt={student.name} className="w-full h-full object-cover" />}
                          <div className="absolute top-1 left-1 flex gap-0.5 shadow-sm">
                             <div className={`w-2.5 h-2.5 rounded-full ${getAttackColor(student.attackType)} border border-white/50`}></div>
                             <div className={`w-2.5 h-2.5 rounded-sm ${getArmorColor(student.armorType)} border border-white/50`}></div>
                          </div>
                          <div className="absolute bottom-1 right-1 text-yellow-400 text-[11px] font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">★{student.starNum || 3}</div>
                        </div>
                        <div className="text-[11px] font-bold text-slate-800 text-center truncate w-full px-1">{student.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Specials */}
              <div className="flex-none flex flex-col gap-2 border-l-2 border-slate-200/50 pl-8">
                <div className="text-sm font-bold text-slate-500 border-b border-slate-300 pb-1">SPECIAL</div>
                <div className="flex gap-3 mt-1">
                  {team.specials.map((studentId, sIdx) => {
                    const student = getStudent(studentId);
                    if (!student) {
                      return (
                         <div key={`empty-sp-${sIdx}`} className="flex flex-col items-center gap-1 w-[80px]">
                           <div className="relative w-[80px] h-[80px] rounded-lg bg-slate-200/50 border-b-4 border-slate-300 flex items-center justify-center opacity-80 overflow-hidden shrink-0">
                              <img src={`${window.location.origin}/images/ui/equip_empty.png`} className="w-1/2 h-1/2 object-contain opacity-50" alt="empty" />
                           </div>
                           <div className="text-[11px] font-bold text-slate-400 text-center truncate w-full px-1">EMPTY</div>
                         </div>
                      );
                    }
                    const iconUrl = getSlotPortraitIconUrl(student);
                    return (
                      <div key={`sp-${sIdx}`} className="flex flex-col items-center gap-1 w-[80px]">
                        <div className="relative w-[80px] h-[80px] rounded-lg bg-slate-100 shadow-md border-b-4 border-[#315B9A] overflow-hidden shrink-0">
                          {iconUrl && <img src={getImageUrl(iconUrl)} alt={student.name} className="w-full h-full object-cover" />}
                          <div className="absolute top-1 left-1 flex gap-0.5 shadow-sm">
                             <div className={`w-2.5 h-2.5 rounded-full ${getAttackColor(student.attackType)} border border-white/50`}></div>
                             <div className={`w-2.5 h-2.5 rounded-sm ${getArmorColor(student.armorType)} border border-white/50`}></div>
                          </div>
                          <div className="absolute bottom-1 right-1 text-yellow-400 text-[11px] font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">★{student.starNum || 3}</div>
                        </div>
                        <div className="text-[11px] font-bold text-slate-800 text-center truncate w-full px-1">{student.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>

      <div className="absolute bottom-4 right-6 z-20 text-slate-500/80 text-xs font-semibold">
        Generated at Plana.AI | Date : {new Date().toLocaleString('ko-KR')}
        {user?.nickname ? ` | By ${user.nickname}` : ''}
      </div>
    </div>
    </div>
  );
});

AllFormationsExportView.displayName = 'AllFormationsExportView';
