import React, { forwardRef } from 'react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { useFormationStore } from '@/store/formationStore';
import { getImageUrl } from '@/components/planner/utils';

interface Props {
  masterData: StudentMaster[];
  schema: SchemaConfig | null;
}

export const SingleFormationExportView = forwardRef<HTMLDivElement, Props>(({ masterData, schema }, ref) => {
  const { teams, activeTeamId, imageOffsets, studentModes } = useFormationStore();
  
  const activeTeam = teams.find(t => t.id === activeTeamId) || teams[0];
  
  const getStudent = (id: number | null) => {
    if (!id) return null;
    return masterData.find(s => s.id === id) || null;
  };

  if (!activeTeam) return null;

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

  const getSlotPortraitUrl = (student: StudentMaster, type: 'striker' | 'special') => {
    const currentMode = studentModes[student.id] || 0;
    if (student.skills && student.skills.length > currentMode && student.skills[currentMode].portraitUrl) {
      return student.skills[currentMode].portraitUrl;
    }
    
    if (type === 'striker') {
      if (student.portraitUrls && student.portraitUrls.length > currentMode + 1 && student.portraitUrls[currentMode + 1]) {
        return student.portraitUrls[currentMode + 1];
      }
      if (student.portraitUrls && student.portraitUrls.length > 1 && student.portraitUrls[1]) {
        return student.portraitUrls[1];
      }
    }

    if (student.portraitUrls && student.portraitUrls.length > 0 && student.portraitUrls[0]) {
      return student.portraitUrls[0];
    }
    return null;
  };

  return (
    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
      <div
        ref={ref}
        className="w-[1400px] h-[800px] flex flex-col overflow-hidden bg-white text-[var(--plana-text-main)] font-sans relative"
      >
      {/* Background Image */}
      <img 
        src={`${window.location.origin}/images/ui/plana_bg.jpg`} 
        alt="background" 
        className="absolute inset-0 w-full h-full object-cover z-0" 
      />
      
      {/* Title */}
      <div className="absolute top-6 left-6 z-20">
         <div className="bg-[#2B3A55] text-[#F3C13A] font-bold text-2xl px-6 py-3 rounded-md shadow-lg italic border-l-4 border-[#F3C13A]">
           {activeTeam.name}
         </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col w-full h-full pb-6">
        
        {/* Strikers Section */}
        <div className="flex-1 flex items-end justify-center w-full px-8 pb-[100px] pt-16 relative overflow-hidden">
          <div className="flex justify-center items-end gap-6 max-w-full w-full h-full relative z-10 overflow-visible">
            {activeTeam.strikers.map((studentId, index) => {
              const student = getStudent(studentId);
              if (!student) return null;
              const portraitUrl = getSlotPortraitUrl(student, 'striker');
              const config = imageOffsets[student.name] || { scale: 200, offsetX: 0, offsetY: 20 };
              
              return (
                <div key={`striker-${index}`} className="relative flex flex-col items-center justify-end shrink min-w-0 w-[180px] h-[400px]">
                  {/* Character Image */}
                  <div className="absolute inset-0 pb-[80px] flex items-end justify-center pointer-events-none">
                    {portraitUrl && (
                      <img
                        src={getImageUrl(portraitUrl)}
                        alt={student.name}
                        className="max-w-none object-cover drop-shadow-xl"
                        style={{ 
                          width: `${config.scale}%`,
                          transform: `translate(${config.offsetX}%, ${config.offsetY}%)`,
                          objectPosition: 'center 20%' 
                        }}
                      />
                    )}
                  </div>

                  {/* Floating Info Badge */}
                  <div className="absolute bottom-0 w-[115%] bg-white rounded shadow-lg z-20 skew-x-[-10deg] border-b-4 border-[#D33F4A] overflow-hidden">
                     <div className="flex bg-slate-100 px-2 py-1 items-center justify-between skew-x-[10deg]">
                       <div className="flex items-center gap-1 font-bold text-xs text-slate-600">
                         <span className="uppercase">{student.position || 'MIDDLE'}</span>
                       </div>
                       <div className="flex gap-1">
                         <div className={`w-3 h-3 rounded-full ${getAttackColor(student.attackType)}`}></div>
                         <div className={`w-3 h-3 rounded-sm ${getArmorColor(student.armorType)}`}></div>
                       </div>
                     </div>
                     <div className="flex bg-white px-2 pt-1 pb-0 items-center justify-center skew-x-[10deg]">
                       <div className="font-bold text-sm text-slate-800 truncate w-full text-center">{student.name}</div>
                     </div>
                     <div className="flex bg-white px-2 py-1 items-center justify-between skew-x-[10deg]">
                       <div className="font-bold text-lg text-yellow-400 drop-shadow-sm flex items-center">
                         <span className="text-sm mr-0.5">★</span>{student.starNum || 3}
                       </div>
                       <div className="font-bold text-slate-700 italic pr-1 text-sm">
                         Lv.90
                       </div>
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Specials Section */}
        <div className="flex-none w-full flex justify-center z-20 relative pb-8 overflow-hidden">
          <div className="flex justify-center items-center gap-6 max-w-full w-full px-6 relative mt-4 overflow-visible pt-4">
            {activeTeam.specials.map((studentId, index) => {
              const student = getStudent(studentId);
              if (!student) return null;
              const portraitUrl = getSlotPortraitUrl(student, 'special');
              
              return (
                <div key={`special-${index}`} className="relative bg-white rounded-lg shadow-md flex items-center p-1 border-b-4 border-[#315B9A] min-w-[120px] w-[200px] h-[70px]">
                  <div className="aspect-square h-full rounded bg-slate-100 overflow-hidden relative shadow-inner shrink-0">
                     {portraitUrl && (
                       <img src={getImageUrl(portraitUrl)} alt={student.name} className="w-full h-full object-cover" />
                     )}
                  </div>
                  <div className="flex-1 px-2 flex flex-col justify-center overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                       <div className="flex gap-1">
                         <div className={`w-2.5 h-2.5 rounded-full ${getAttackColor(student.attackType)}`}></div>
                         <div className={`w-2.5 h-2.5 rounded-sm ${getArmorColor(student.armorType)}`}></div>
                       </div>
                    </div>
                    <div className="font-bold text-sm truncate text-slate-700">{student.name}</div>
                    <div className="font-bold text-xs text-yellow-500 mt-0.5">★{student.starNum || 3} <span className="text-slate-400 italic font-normal ml-1">Lv.90</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
    </div>
  );
});

SingleFormationExportView.displayName = 'SingleFormationExportView';
