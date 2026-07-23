import React, { useMemo, useEffect } from 'react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { useFormationStore } from '@/store/formationStore';
import { TeamSlot } from './TeamSlot';

interface Props {
  masterData: StudentMaster[];
  schema: SchemaConfig | null;
}

export function ActiveTeamView({ masterData, schema }: Props) {
  const { teams, activeTeamId, mode, fetchImageOffsets } = useFormationStore();

  useEffect(() => {
    fetchImageOffsets();
  }, [fetchImageOffsets]);

  const activeTeam = useMemo(() => {
    return teams.find(t => t.id === activeTeamId) || teams[0];
  }, [teams, activeTeamId]);

  const getStudent = (id: number | null) => {
    if (!id) return null;
    return masterData.find(s => s.id === id || String(s.id) === String(id)) || null;
  };

  if (!activeTeam) return null;

  return (
    <div className="flex-1 h-full flex flex-col min-h-0 relative">
      
      <div className="relative z-10 flex-1 flex flex-col w-full h-full pb-6">
        
        {/* Strikers Section - Fills the main center area */}
        <div className="flex-1 flex items-end justify-center w-full px-2 sm:px-8 pb-[100px] pt-16 relative overflow-hidden">
          


          <div className="flex justify-center items-end gap-2 sm:gap-4 md:gap-6 lg:gap-8 max-w-full w-full h-full relative z-10 pl-24 md:pl-32 pr-2 sm:pr-4 overflow-visible">
            {activeTeam.strikers.map((studentId, index) => (
              <TeamSlot
                key={`striker-${index}`}
                type="striker"
                index={index}
                student={getStudent(studentId)}
                teamId={activeTeam.id}
                isCompact={activeTeam.strikers.length > 4}
              />
            ))}
          </div>
        </div>

        {/* Specials Section - Floating at the bottom */}
        <div className="flex-none w-full flex justify-center z-20 relative pb-4 overflow-hidden">
          


          <div className="flex justify-center items-center gap-1 sm:gap-2 md:gap-4 max-w-full w-full pl-24 md:pl-32 pr-4 sm:pr-6 relative mt-4 overflow-visible pt-4">
            {activeTeam.specials.map((studentId, index) => (
              <TeamSlot
                key={`special-${index}`}
                type="special"
                index={index}
                student={getStudent(studentId)}
                teamId={activeTeam.id}
                isCompact={activeTeam.specials.length > 2}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
