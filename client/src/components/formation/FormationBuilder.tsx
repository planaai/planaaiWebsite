import React, { useState } from 'react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { useFormationStore, FormationMode, RosterType } from '@/store/formationStore';
import { RosterPanel } from './RosterPanel';
import { ActiveTeamView } from './ActiveTeamView';
import { TeamTabs } from './TeamTabs';
import { toPng } from 'html-to-image';
import { format } from 'date-fns';
import { Camera, Loader2 } from 'lucide-react';

interface Props {
  masterData: StudentMaster[];
  schema: SchemaConfig | null;
}

export function FormationBuilder({ masterData, schema }: Props) {
  const { mode, setMode, rosterType, setRosterType, teams, activeTeamId, setActiveTeam } = useFormationStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    const el = document.getElementById('formation-capture-area');
    if (!el) return;
    
    setIsExporting(true);
    try {
      // Allow UI to settle
      await new Promise(res => setTimeout(res, 100));
      
      const dataUrl = await toPng(el, {
        cacheBust: true,
        backgroundColor: '#F8F9FA', // Fallback background
        style: {
          backgroundImage: "url('/images/ui/plana_bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        },
        filter: (node) => {
          // exclude elements that we don't want in the screenshot if any
          return true;
        }
      });
      
      const activeTeam = teams.find(t => t.id === activeTeamId);
      const teamName = activeTeam ? activeTeam.name : '부대';
      const dateStr = format(new Date(), 'yyyyMMdd_HHmmss');
      
      const link = document.createElement('a');
      link.download = `planaai_${teamName}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
      alert('이미지 저장에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

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
            
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center space-x-2 px-4 py-1.5 text-sm rounded-md transition-colors font-bold bg-white border border-[var(--plana-primary)] text-[var(--plana-primary-dark)] hover:bg-[var(--plana-primary-light)] hover:text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              <span>이미지 저장</span>
            </button>
          </div>
        </div>

        {/* Main Layout Area */}
        <div className="flex-1 flex overflow-hidden bg-transparent">
          {/* Left Side: Formation View */}
          <div id="formation-capture-area" className="flex-1 flex flex-col min-w-[700px] relative overflow-hidden bg-transparent">
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
