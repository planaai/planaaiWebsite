import React from 'react';
import type { StudentMaster } from '@/types';
import { useFormationStore } from '@/store/formationStore';
import { useAlert } from '@/contexts/AlertContext';
import { X, Plus, User } from 'lucide-react';
import { getImageUrl } from '@/components/planner/utils';

interface Props {
  type: 'striker' | 'special';
  index: number;
  student: StudentMaster | null;
  teamId: string;
  isCompact?: boolean;
}

export function TeamSlot({ type, index, student, teamId, isCompact }: Props) {
  const { mode, teams, removeStudent, assignStudent, swapStudents, imageOffsets, studentModes, setStudentMode } = useFormationStore();
  const { showConfirm } = useAlert();

  const currentMode = student ? (studentModes[student.id] || 0) : 0;
  
  const handleModeToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (student && student.skills && student.skills.length > 1) {
      setStudentMode(student.id, currentMode === 0 ? 1 : 0);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (student) {
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({
          sourceTeamId: teamId,
          sourceType: type,
          sourceIndex: index,
          type: type, // for validation
          studentId: student.id,
        })
      );
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === type) { // Validate striker vs special
          if (parsed.sourceTeamId && parsed.sourceIndex !== undefined) {
            // Swap between slots
            swapStudents(parsed.sourceTeamId, parsed.sourceType, parsed.sourceIndex, teamId, type, index);
          } else {
            // Assign from roster
            const doAssign = () => assignStudent(teamId, type, index, parsed.studentId);
            
            if (mode === 'raid') {
              const assignedTeam = teams.find(t => t.strikers.includes(parsed.studentId) || t.specials.includes(parsed.studentId));
              if (assignedTeam && assignedTeam.id !== teamId) {
                showConfirm(
                  '편성 확인',
                  `이 학생은 ${assignedTeam.name}에 이미 편성되어 있습니다. 확인을 누르시면 기존 부대에서 제외되어 현재 부대로 옮겨집니다.`,
                  doAssign
                );
                return;
              }
            }
            
            doAssign();
          }
        } else {
          console.warn(`Cannot assign ${parsed.type} to ${type} slot`);
        }
      } catch (err) {
        console.error('Failed to parse dropped data', err);
      }
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeStudent(teamId, type, index);
  };

  const getAttackColor = (type: string) => {
    switch(type) {
      case 'Explosion': return 'bg-[#D33F4A]';
      case 'Pierce': return 'bg-[#E09F36]';
      case 'Mystic': return 'bg-[#315B9A]';
      case 'Vibration': return 'bg-[#8B5FBF]';
      case 'Decomposition': return 'bg-[#1ABC9C]'; // 청록색
      default: return 'bg-slate-500';
    }
  };

  const getArmorColor = (type: string) => {
    switch(type) {
      case 'LightArmor': return 'bg-[#D33F4A]';
      case 'HeavyArmor': return 'bg-[#E09F36]';
      case 'MysticArmor':
      case 'Unarmed': return 'bg-[#315B9A]'; // Special armor
      case 'ElasticArmor': return 'bg-[#8B5FBF]';
      case 'CompositeArmor': return 'bg-[#1ABC9C]'; // 청록색
      default: return 'bg-slate-500';
    }
  };

  // Helper for portrait URL
  const getSlotPortraitUrl = () => {
    if (!student) return null;
    if (student.skills && student.skills.length > currentMode && student.skills[currentMode].portraitUrl) {
      return student.skills[currentMode].portraitUrl;
    }
    if (student.portraitUrls && student.portraitUrls.length > currentMode) {
      return student.portraitUrls[currentMode];
    }
    if (student.portraitUrls && student.portraitUrls.length > 0) {
      return student.portraitUrls[0];
    }
    return null;
  };

  const portraitUrl = getSlotPortraitUrl();

  // Striker Rendering
  if (type === 'striker') {
    const sizeClasses = isCompact 
      ? "w-[95px] sm:w-[105px] md:w-[115px] lg:w-[125px] h-[180px] sm:h-[220px] lg:h-[250px]" 
      : "w-[120px] sm:w-[140px] md:w-[160px] lg:w-[180px] h-[300px] sm:h-[350px] lg:h-[400px]";

    return (
      <div
        draggable={!!student}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-end group shrink cursor-pointer min-w-0 ${sizeClasses}`}
      >
        {/* Character Image */}
        {student ? (
          <div className="absolute inset-0 pb-[80px] flex items-end justify-center pointer-events-none">
            {portraitUrl ? (
              (() => {
                const config = imageOffsets[student.name] || { scale: 200, offsetX: 0, offsetY: 20 };
                return (
                  <img
                    src={getImageUrl(portraitUrl)}
                    alt={student.name}
                    className="max-w-none object-cover drop-shadow-xl transition-transform"
                    style={{ 
                      width: `${config.scale}%`,
                      transform: `translate(${config.offsetX}%, ${config.offsetY}%)`,
                      objectPosition: 'center 20%' 
                    }}
                  />
                );
              })()
            ) : (
              <div className="relative mb-8 pointer-events-auto">
                <div className={`${isCompact ? 'w-[65px] h-[65px]' : 'w-[100px] h-[100px]'} bg-slate-100/80 rounded-full flex items-center justify-center text-slate-400 shadow-lg group-hover:text-[var(--plana-primary)] transition-colors`}>
                  <User size={isCompact ? 32 : 48} strokeWidth={1.5} />
                </div>
                <button
                  onClick={handleRemove}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-50 shadow-md"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            {/* Remove Button (only for images, fallback has its own) */}
            {(student.portraitUrls && student.portraitUrls.length > 0) && (
              <button
                onClick={handleRemove}
                className="absolute top-2 right-2 sm:top-6 sm:right-6 bg-red-500 text-white rounded-full p-2.5 sm:p-3 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 z-50 pointer-events-auto shadow-lg hover:scale-110"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            )}

            {/* Mode Toggle Button */}
            {student.skills && student.skills.length > 1 && (
              <button
                onClick={handleModeToggle}
                className="absolute top-2 left-2 sm:top-6 sm:left-6 bg-[var(--plana-primary)] text-white text-xs font-bold rounded-full px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 z-50 pointer-events-auto shadow-lg hover:scale-105"
              >
                {student.skills[currentMode].modeName || '모드 변경'}
              </button>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 pb-[80px] flex flex-col items-center justify-center opacity-30 group-hover:opacity-100 transition-opacity">
            <Plus size={48} className="text-[var(--plana-primary)] drop-shadow-sm" />
          </div>
        )}

        {/* Floating Info Badge */}
        {student && (
          <div className="absolute bottom-0 w-[115%] bg-white rounded shadow-lg z-20 skew-x-[-10deg] border-b-4 border-[#D33F4A] overflow-hidden">
             {/* Top info row */}
             <div className="flex bg-slate-100 px-2 py-1 items-center justify-between skew-x-[10deg]">
               <div className="flex items-center gap-1 font-bold text-xs text-slate-600">
                 <span className="uppercase">{student.position || 'MIDDLE'}</span>
               </div>
               <div className="flex gap-1">
                 <div className={`w-3 h-3 rounded-full ${getAttackColor(student.attackType)}`} title={student.attackType}></div>
                 <div className={`w-3 h-3 rounded-sm ${getArmorColor(student.armorType)}`} title={student.armorType}></div>
               </div>
             </div>
             {/* Middle info row (Name) */}
             <div className="flex bg-white px-2 pt-1 pb-0 items-center justify-center skew-x-[10deg]">
               <div className="font-bold text-sm text-slate-800 truncate w-full text-center">{student.name}</div>
             </div>
             {/* Bottom info row */}
             <div className="flex bg-white px-2 py-1 items-center justify-between skew-x-[10deg]">
               <div className="font-bold text-lg text-yellow-400 drop-shadow-sm flex items-center">
                 <span className="text-sm mr-0.5">★</span>{student.starNum || 3}
               </div>
               <div className="font-bold text-slate-700 italic pr-1 text-sm">
                 Lv.90
               </div>
             </div>
          </div>
        )}
        
        {!student && (
          <div className="absolute bottom-0 w-full h-[50px] bg-white/50 backdrop-blur rounded shadow-sm z-20 skew-x-[-10deg] flex items-center justify-center border-b-4 border-slate-300">
             <div className="skew-x-[10deg] text-slate-400 font-bold text-xl">
               {index + 1}
             </div>
          </div>
        )}
      </div>
    );
  }

  // Special Rendering
  const specialSizeClasses = isCompact
    ? "w-[150px] sm:w-[170px] md:w-[190px] h-[50px] sm:h-[60px]"
    : "w-[180px] sm:w-[200px] h-[60px] sm:h-[70px]";

  return (
    <div
      draggable={!!student}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative bg-white rounded-lg shadow-md flex items-center p-1 group shrink cursor-pointer border-b-4 min-w-[120px] ${specialSizeClasses} ${student ? 'border-[#315B9A]' : 'border-slate-300 bg-white/50 backdrop-blur-sm'}`}
    >
      {student ? (
        <>
          <div className="aspect-square h-full rounded bg-slate-100 overflow-hidden relative shadow-inner shrink-0 cursor-pointer" onClick={handleModeToggle}>
             {portraitUrl ? (
               <img src={getImageUrl(portraitUrl)} alt={student.name} className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100 group-hover:text-[var(--plana-primary)] transition-colors"><User size={28} strokeWidth={1.5} /></div>
             )}
             
             {/* Mode Toggle Indicator for special */}
             {student.skills && student.skills.length > 1 && (
               <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center font-bold pb-0.5">
                 {student.skills[currentMode].modeName}
               </div>
             )}
          </div>
          
          <div className="flex-1 px-2 flex flex-col justify-center overflow-hidden">
            <div className="flex justify-between items-center mb-1">
               <div className="flex gap-1">
                 <div className={`w-2.5 h-2.5 rounded-full ${getAttackColor(student.attackType)}`}></div>
                 <div className={`w-2.5 h-2.5 rounded-sm ${getArmorColor(student.armorType)}`}></div>
               </div>
            </div>
            <div className="font-bold text-xs sm:text-sm truncate text-slate-700">{student.name}</div>
            <div className="font-bold text-xs text-yellow-500 mt-0.5">★{student.starNum || 3} <span className="text-slate-400 italic font-normal ml-1">Lv.90</span></div>
          </div>
          
          {/* Remove Button */}
          <button
            onClick={handleRemove}
            className="absolute -top-2.5 -right-2.5 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-lg z-10 hover:scale-110"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400/70 gap-2">
          <Plus size={20} />
          <span className="font-bold text-sm tracking-widest">SPECIAL</span>
        </div>
      )}
    </div>
  );
}
