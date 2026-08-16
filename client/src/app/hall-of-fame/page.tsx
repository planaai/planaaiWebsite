'use client';

import { useEffect, useState } from 'react';
import { api, fetchServerData, getImageUrl } from '@/lib/api';
import { Trophy, Star, Sparkles, Medal } from 'lucide-react';

interface HofEntry {
  id: number;
  studentId: number;
  achievement: string | null;
  isVisible: boolean;
  createdAt: string;
  student: {
    id: number;
    name: string;
    imagePath: string | null;
    school: string;
  };
}

export default function HallOfFamePage() {
  const [entries, setEntries] = useState<HofEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [masterMap, setMasterMap] = useState<Record<number, any>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [res, { masterData }] = await Promise.all([
          api.get('/hof'),
          fetchServerData()
        ]);
        setEntries(res.data);
        
        const map: Record<number, any> = {};
        masterData.forEach(m => { map[m.id] = m; });
        setMasterMap(map);
      } catch (err) {
        console.error('명예의 전당 데이터를 불러오지 못했습니다.', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="relative w-full min-h-[calc(100vh-8rem)] flex flex-col items-center z-20 bg-transparent py-12 px-4 sm:px-8">
      <main className="w-full max-w-[1200px] flex flex-col gap-10">
        
        {/* Header Section */}
        <div className="flex flex-col items-center justify-center text-center fade-in-anim">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--plana-bg-panel)]/80 border border-[var(--plana-primary-light)] backdrop-blur-md mb-4 text-[var(--plana-primary-dark)] font-bold tracking-wide shadow-sm">
            <Sparkles size={16} />
            <span>Hall of Fame</span>
            <Sparkles size={16} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-800 mb-4 drop-shadow-sm">
            명예의 <span className="text-[var(--plana-primary)]">전당</span>
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
            Plana.AI 발전에 기여해 주신 선생님들을 기념하는 공간입니다.<br className="hidden md:block" />
            <span className="text-sm text-slate-500 font-normal">(기여자는 선생님이 지정하신 대표 학생으로 표기됩니다.)</span>
          </p>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Trophy className="w-16 h-16 text-[var(--plana-primary-light)] mb-4 animate-bounce" />
            <p className="text-slate-500 font-bold">기록을 불러오는 중...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-[var(--plana-bg-panel)]/80 backdrop-blur-xl border border-[var(--plana-primary-light)] rounded-2xl shadow-lg fade-in-anim">
            <div className="w-20 h-20 rounded-full bg-[var(--plana-primary-light)]/20 border border-[var(--plana-primary)] flex items-center justify-center text-[var(--plana-primary-dark)] mb-6 shadow-sm">
              <Medal size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-700 mb-2">아직 등재된 선생님이 없습니다</h3>
            <p className="text-slate-500 font-medium">곧 위대한 기여 기록들이 이곳에 새겨질 것입니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {entries.map((entry, index) => {
              const masterStudent = masterMap[entry.studentId];
              const portraitUrl = masterStudent?.portraitUrls?.[0];
              const imgSrc = portraitUrl ? getImageUrl(portraitUrl) : `https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/images/student/icon/${entry.studentId}.webp`;

              return (
              <div 
                key={entry.id}
                className="group relative flex flex-col bg-[var(--plana-bg-panel)]/95 backdrop-blur-xl border border-[var(--plana-primary-light)] shadow-lg transition-all duration-300 hover:-translate-y-2 hover:bg-white/95 hover:border-[var(--plana-primary)] hover:shadow-[0_10px_30px_rgba(255,166,201,0.4)] overflow-hidden slide-in-right-anim"
                style={{ animationDelay: `${index * 0.1}s`, borderRadius: '1rem' }}
              >
                {/* Accent Top Bar */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-[var(--plana-primary)] opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>

                {/* Ranking Badge */}
                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-[var(--plana-primary-light)] to-[var(--plana-primary)] text-white flex items-center justify-center font-black text-lg shadow-md border-2 border-white z-20 group-hover:scale-110 transition-transform duration-300">
                  {index + 1}
                </div>

                <div className="p-6 pt-8 flex items-start gap-5 relative z-10">
                  {/* Student Image */}
                  <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-white shadow-md group-hover:border-[var(--plana-primary-light)] transition-colors duration-300 flex-shrink-0 bg-slate-100">
                    <img
                      src={imgSrc}
                      alt={entry.student.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/images/student/icon/10000.webp'; }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center h-20 md:h-24">
                    <div className="text-xs font-bold text-[var(--plana-primary-dark)] mb-1 uppercase tracking-wider flex items-center gap-1">
                      <Star size={12} className="fill-current" />
                      {entry.student.school || 'KIVOTOS'}
                    </div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 truncate group-hover:text-[var(--plana-primary-dark)] transition-colors">
                      {entry.student.name}
                    </h2>
                  </div>
                </div>

                <div className="px-6 pb-6 flex-1 flex flex-col justify-between">
                  <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-4 mb-4 min-h-[4.5rem]">
                    <p className="text-sm font-medium text-slate-600 leading-relaxed line-clamp-3">
                      {entry.achievement || 'Plana.AI 발전에 크게 기여하셨습니다.'}
                    </p>
                  </div>
                  
                  {/* Footer Data */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-t border-slate-100 pt-3">
                    <span className="flex items-center gap-1.5 text-[var(--plana-primary-dark)]/70">
                      <Trophy size={14} />
                      명예의 전당 헌액
                    </span>
                    <span>{new Date(entry.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
