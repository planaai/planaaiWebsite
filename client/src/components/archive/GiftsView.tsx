'use client';

import React, { useState, useMemo } from 'react';
import type { StudentMaster, SchemaConfig, Gift } from '@/types';
import Link from 'next/link';

interface GiftsViewProps {
  initialMasterData: StudentMaster[];
  schema: SchemaConfig;
}

export function GiftsView({ initialMasterData, schema }: GiftsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'Normal' | 'HighGrade'>('ALL');
  const [affinityFilter, setAffinityFilter] = useState<'ALL' | 'level2' | 'level3' | 'level4'>('ALL');

  const gifts = schema.gifts || [];
  
  // Create a fast lookup for students
  const studentMap = useMemo(() => {
    const map = new Map<number, StudentMaster>();
    initialMasterData.forEach(s => map.set(s.id, s));
    return map;
  }, [initialMasterData]);

  // Filter gifts based on conditions
  const filteredGifts = useMemo(() => {
    return gifts.filter(gift => {
      // 1. Tier Filter
      if (tierFilter !== 'ALL' && gift.tier !== tierFilter) return false;
      
      // 2. Search Term Filter
      const term = searchTerm.toLowerCase();
      let matchesSearch = false;
      if (!term || gift.name.toLowerCase().includes(term)) {
        matchesSearch = true;
      } else {
        // Check if any student in the affinity list matches the search term
        const checkStudentMatch = (ids: number[]) => ids.some(id => studentMap.get(id)?.name.toLowerCase().includes(term));
        if (
          (affinityFilter === 'ALL' || affinityFilter === 'level4') && checkStudentMatch(gift.affinity.level4) ||
          (affinityFilter === 'ALL' || affinityFilter === 'level3') && checkStudentMatch(gift.affinity.level3) ||
          (affinityFilter === 'ALL' || affinityFilter === 'level2') && checkStudentMatch(gift.affinity.level2)
        ) {
          matchesSearch = true;
        }
      }
      if (!matchesSearch) return false;

      // 3. Affinity Level Filter (Only show gifts that have AT LEAST ONE student matching the chosen affinity level)
      // If a gift doesn't have anyone in level4, and we filter by level4, it shouldn't show.
      if (affinityFilter !== 'ALL') {
        if (gift.affinity[affinityFilter].length === 0) return false;
      }

      return true;
    });
  }, [gifts, tierFilter, affinityFilter, searchTerm, studentMap]);

  return (
    <div className="space-y-6 slide-in-right-anim">
      {/* Search Header */}
      <div className="bg-white/90 rounded-2xl p-6 border border-[var(--plana-border)] backdrop-blur-md shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 clip-diagonal relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--plana-primary)] opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-[var(--plana-text-main)] flex items-center gap-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--plana-primary-dark)] to-[var(--plana-accent)]">
              선호 선물
            </span> 도감
          </h2>
          <p className="text-[var(--plana-text-muted)] mt-1 font-medium">선물을 가장 좋아하는 학생들을 찾아보세요.</p>
        </div>
        <div className="text-sm font-bold text-[var(--plana-text-muted)]">
          총 {gifts.length}개의 선물
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/80 p-3 rounded-xl border border-[var(--plana-border)] backdrop-blur-sm shadow-sm">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-[var(--plana-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input
            type="text"
            placeholder="선물 이름, 학생 이름 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[var(--plana-border)] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[var(--plana-text-main)] focus:outline-none focus:border-[var(--plana-accent)] focus:ring-1 focus:ring-[var(--plana-accent)] transition-all"
          />
        </div>
        
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as any)}
          className="bg-white border border-[var(--plana-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--plana-text-main)] focus:outline-none focus:border-[var(--plana-accent)] appearance-none shadow-sm cursor-pointer"
        >
          <option value="ALL">모든 등급</option>
          <option value="Normal">일반 선물</option>
          <option value="HighGrade">고급 선물</option>
        </select>

        <select
          value={affinityFilter}
          onChange={(e) => setAffinityFilter(e.target.value as any)}
          className="bg-white border border-[var(--plana-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--plana-text-main)] focus:outline-none focus:border-[var(--plana-accent)] appearance-none shadow-sm cursor-pointer"
        >
          <option value="ALL">모든 호감도</option>
          <option value="level4">매우 선호 (Lv.4)</option>
          <option value="level3">상급 (Lv.3)</option>
          <option value="level2">일반 (Lv.2)</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredGifts.length === 0 ? (
          <div className="text-center py-20 bg-white/80 rounded-2xl border border-[var(--plana-border)]">
            <span className="text-4xl block mb-4">🥲</span>
            <h3 className="text-xl font-bold text-[var(--plana-text-muted)]">조건에 맞는 선물이 없습니다.</h3>
          </div>
        ) : (
          filteredGifts.map(gift => (
            <div key={gift.key} className="bg-white border border-[var(--plana-border)] rounded-xl p-4 flex flex-col md:flex-row gap-6 hover:border-[var(--plana-accent)] transition-all shadow-[0_4px_10px_rgba(188,163,240,0.1)] hover:shadow-[0_8px_20px_rgba(255,166,201,0.2)] clip-diagonal">
              
              {/* Gift Info Side */}
              <div className="flex items-center gap-4 md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-[var(--plana-border)] pb-4 md:pb-0 md:pr-4">
                <div className={`w-20 h-20 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden shadow-sm border ${gift.tier === 'HighGrade' ? 'bg-[var(--plana-primary-light)]/20 border-[var(--plana-primary-light)]' : 'bg-slate-50 border-[var(--plana-border)]'}`}>
                   <div className={`absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-bl-lg font-black border-l border-b ${gift.tier === 'HighGrade' ? 'bg-[var(--plana-primary-light)] text-[var(--plana-primary-dark)] border-[var(--plana-primary-light)]' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                     {gift.tier === 'HighGrade' ? '고급' : '일반'}
                   </div>
                   {gift.iconUrl ? (
                     <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${gift.iconUrl}`} alt={gift.name} className="w-14 h-14 object-contain drop-shadow-sm z-10 hover:scale-110 transition-transform" />
                   ) : (
                     <span className="text-[var(--plana-text-muted)] text-xs font-bold">NO IMG</span>
                   )}
                </div>
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <h3 className="text-lg font-black text-[var(--plana-text-main)] truncate">{gift.name}</h3>
                  <p className="text-xs text-[var(--plana-text-muted)] mt-1 max-h-20 overflow-y-auto leading-relaxed pr-2 custom-scrollbar break-keep">{gift.description}</p>
                </div>
              </div>

              {/* Students Side */}
              <div className="flex-1 flex flex-col justify-center gap-4">
                {/* Level 4 */}
                {(affinityFilter === 'ALL' || affinityFilter === 'level4') && gift.affinity.level4.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-16 shrink-0 flex flex-col items-end">
                      {schema.resourceIcons?.Affinity?.level4 ? (
                        <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${schema.resourceIcons.Affinity.level4}`} alt="매우 선호" className="w-8 h-8 object-contain drop-shadow-md" />
                      ) : (
                        <span className="text-[10px] font-black text-[var(--plana-primary-dark)] bg-[var(--plana-primary-light)]/30 border border-[var(--plana-primary-light)] px-2 py-1 rounded">매우 선호</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {gift.affinity.level4.map(id => {
                        const student = studentMap.get(id);
                        if (!student) return null;
                        return (
                          <Link key={id} href={`/archive/student/${id}`} className="group relative w-16 h-16 bg-white border border-[var(--plana-primary-light)] rounded-lg overflow-hidden flex items-center justify-center hover:border-[var(--plana-accent)] transition-colors shadow-sm">
                            {student.portraitUrl ? <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${student.portraitUrl}`} alt={student.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /> : <span className="text-[8px] text-[var(--plana-text-muted)]">{student.name}</span>}
                            <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="text-[var(--plana-primary)] text-[10px] font-bold text-center px-1 leading-tight">{student.name}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Level 3 */}
                {(affinityFilter === 'ALL' || affinityFilter === 'level3') && gift.affinity.level3.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-16 shrink-0 flex flex-col items-end">
                      {schema.resourceIcons?.Affinity?.level3 ? (
                        <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${schema.resourceIcons.Affinity.level3}`} alt="상급" className="w-7 h-7 object-contain drop-shadow-md" />
                      ) : (
                        <span className="text-[10px] font-black text-blue-500 bg-blue-100 border border-blue-200 px-2 py-1 rounded">상급</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {gift.affinity.level3.map(id => {
                        const student = studentMap.get(id);
                        if (!student) return null;
                        return (
                          <Link key={id} href={`/archive/student/${id}`} className="group relative w-14 h-14 bg-white border border-blue-200 rounded-lg overflow-hidden flex items-center justify-center hover:border-blue-400 transition-colors shadow-sm">
                            {student.portraitUrl ? <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${student.portraitUrl}`} alt={student.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /> : <span className="text-[8px] text-[var(--plana-text-muted)]">{student.name}</span>}
                            <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="text-blue-500 text-[10px] font-bold text-center px-1 leading-tight">{student.name}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Level 2 */}
                {(affinityFilter === 'ALL' || affinityFilter === 'level2') && gift.affinity.level2.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-16 shrink-0 flex flex-col items-end">
                      {schema.resourceIcons?.Affinity?.level2 ? (
                        <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${schema.resourceIcons.Affinity.level2}`} alt="일반" className="w-6 h-6 object-contain drop-shadow-md" />
                      ) : (
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded">일반</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {gift.affinity.level2.map(id => {
                        const student = studentMap.get(id);
                        if (!student) return null;
                        return (
                          <Link key={id} href={`/archive/student/${id}`} className="group relative w-12 h-12 bg-white border border-emerald-200 rounded-md overflow-hidden flex items-center justify-center hover:border-emerald-400 transition-colors shadow-sm opacity-90 hover:opacity-100">
                            {student.portraitUrl ? <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${student.portraitUrl}`} alt={student.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /> : <span className="text-[8px] text-[var(--plana-text-muted)]">{student.name}</span>}
                            <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="text-emerald-500 text-[9px] font-bold text-center leading-tight truncate">{student.name.substring(0, 4)}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {gift.affinity.level4.length === 0 && gift.affinity.level3.length === 0 && gift.affinity.level2.length === 0 && (
                   <div className="text-sm text-[var(--plana-text-muted)] italic py-2">등록된 선호 학생이 없습니다.</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
