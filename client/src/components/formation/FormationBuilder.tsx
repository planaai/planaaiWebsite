import React, { useState } from 'react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { useFormationStore, FormationMode, RosterType } from '@/store/formationStore';
import { RosterPanel } from './RosterPanel';
import { ActiveTeamView } from './ActiveTeamView';
import { TeamTabs } from './TeamTabs';

interface Props {
  masterData: StudentMaster[];
  schema: SchemaConfig | null;
}

export function FormationBuilder({ masterData, schema }: Props) {
  const { mode, setMode, rosterType, setRosterType, teams, activeTeamId, setActiveTeam } = useFormationStore();

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] text-[var(--plana-text-main)] overflow-hidden w-screen relative left-1/2 -translate-x-1/2">
      <div className="max-w-[1600px] w-full mx-auto flex flex-col h-full relative">
        {/* Header Controls */}
        <div className="flex-none px-4 py-3 flex items-center justify-between z-10 bg-transparent">
          <div className="flex items-center space-x-4 sm:space-x-6">
            <h1 className="px-5 py-2 text-sm sm:text-base rounded-lg bg-white text-[var(--plana-primary-dark)] shadow-sm font-bold font-gyeonggi-title border border-slate-200">
              모의 편성
            </h1>
            
            <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
              {(['normal', 'raid', 'elimination'] as FormationMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
                    mode === m
                      ? 'bg-[var(--plana-primary)] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {m === 'normal' ? '일반' : m === 'raid' ? '총력전/대결전' : '제약해제결전'}
                </button>
              ))}
            </div>

            <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
              {(['collection', 'all'] as RosterType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setRosterType(t)}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
                    rosterType === t
                      ? 'bg-[var(--plana-accent)] text-[var(--plana-text-main)] shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t === 'collection' ? '보유 캐릭터' : '전체 학생(도감)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Layout Area */}
        <div className="flex-1 flex overflow-hidden bg-transparent">
          {/* Left Side: Formation View */}
          <div className="flex-1 flex flex-col min-w-[700px] relative overflow-hidden bg-transparent">
            {teams.length > 0 ? (
              <div className="flex flex-col h-full w-full relative">
                <TeamTabs />
                <ActiveTeamView masterData={masterData} schema={schema} />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                부대를 편성해주세요.
              </div>
            )}
          </div>

          {/* Right Side: Roster Panel */}
          <div className="w-[340px] flex-none flex flex-col z-20 bg-transparent">
            <RosterPanel masterData={masterData} schema={schema} />
          </div>
        </div>
      </div>
    </div>
  );
}
