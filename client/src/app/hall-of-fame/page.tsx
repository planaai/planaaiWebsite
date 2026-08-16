'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Trophy, Star, Sparkles, Medal } from 'lucide-react';
import Image from 'next/image';

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

  useEffect(() => {
    const fetchHof = async () => {
      try {
        const res = await api.get('/hof');
        setEntries(res.data);
      } catch (err) {
        console.error('명예의 전당 데이터를 불러오지 못했습니다.', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHof();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <main className="max-w-7xl mx-auto px-6 py-16 relative z-10">
        {/* Header Section */}
        <div className="text-center mb-20 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 backdrop-blur-md mb-4 text-blue-400 font-medium tracking-wide">
            <Sparkles size={16} />
            <span>Hall of Fame</span>
            <Sparkles size={16} />
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            명예의 전당
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            블루아카이브 세계관 속 최고의 활약을 보여준 학생들을 기리는 공간입니다.
          </p>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Trophy className="w-16 h-16 text-slate-600 mb-4 animate-bounce" />
            <p className="text-slate-400 font-medium">기록을 불러오는 중...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-32 bg-slate-900/40 rounded-3xl border border-slate-800/50 backdrop-blur-sm">
            <Medal className="w-20 h-20 text-slate-700 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-slate-300 mb-2">아직 등재된 학생이 없습니다</h3>
            <p className="text-slate-500">곧 위대한 기록들이 이곳에 새겨질 것입니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {entries.map((entry, index) => (
              <div 
                key={entry.id}
                className="group relative bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 hover:bg-slate-800/60 hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.2)]"
              >
                {/* Ranking Badge */}
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-black text-xl shadow-lg border-2 border-[#0a0a0f] z-20 group-hover:scale-110 transition-transform duration-300">
                  #{index + 1}
                </div>

                <div className="flex items-start gap-6 relative z-10">
                  {/* Student Image */}
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-700 group-hover:border-blue-400/50 transition-colors duration-300 shadow-xl flex-shrink-0 bg-slate-800">
                    <img
                      src={`https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/images/student/collection/${entry.studentId}.webp`}
                      alt={entry.student.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/images/student/icon/10000.webp'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-1">
                    <div className="text-xs font-bold text-blue-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                      <Star size={12} className="fill-current" />
                      {entry.student.school || 'KIVOTOS'}
                    </div>
                    <h2 className="text-2xl font-black text-slate-100 mb-2 truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 transition-all">
                      {entry.student.name}
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                      {entry.achievement || '특별한 업적을 남겼습니다.'}
                    </p>
                  </div>
                </div>

                {/* Footer Data */}
                <div className="mt-6 pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Trophy size={14} className="text-amber-500" />
                    명예의 전당 헌액
                  </span>
                  <span>{new Date(entry.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
