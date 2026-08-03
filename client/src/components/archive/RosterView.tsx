'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Filter, Star, CheckCircle, Circle } from 'lucide-react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { useArchiveStore } from '@/store/archiveStore';
import { useRosterFilterStore } from '@/store/rosterFilterStore';
import { RegistrationModal } from './RegistrationModal';

interface RosterViewProps {
  initialMasterData: StudentMaster[];
  schema: SchemaConfig | null;
  mode?: 'collection' | 'archive';
}

export function RosterView({ initialMasterData, schema, mode = 'collection' }: RosterViewProps) {
  const { collection, archive, setFilter } = useRosterFilterStore();
  const filters = mode === 'collection' ? collection : archive;

  const searchQuery = filters.searchQuery;
  const filterSchool = filters.filterSchool;
  const filterRole = filters.filterRole;
  const filterFieldType = filters.filterFieldType;
  const filterOwned = filters.filterOwned;

  const setSearchQuery = (val: string) => setFilter(mode, 'searchQuery', val);
  const setFilterSchool = (val: string) => setFilter(mode, 'filterSchool', val);
  const setFilterRole = (val: string) => setFilter(mode, 'filterRole', val);
  const setFilterFieldType = (val: string) => setFilter(mode, 'filterFieldType', val);
  const setFilterOwned = (val: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => setFilter(mode, 'filterOwned', val);

  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const records = useArchiveStore(state => state.records);

  const filteredData = useMemo(() => {
    const list = initialMasterData.filter(master => {
      const isOwned = !!records[master.id];
      if (mode === 'collection') {
        if (filterOwned === 'owned' && !isOwned) return false;
        if (filterOwned === 'unowned' && isOwned) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!master.name.toLowerCase().includes(q) && !master.studentNumber?.toString().includes(q)) {
          return false;
        }
      }
      
      if (filterSchool && master.school !== filterSchool) return false;
      if (filterRole && master.Role !== filterRole) return false;
      if (filterFieldType && master.fieldType !== filterFieldType) return false;
      
      return true;
    });

    return list;
  }, [initialMasterData, records, searchQuery, filterSchool, filterRole, filterFieldType, filterOwned]);

  const stats = useMemo(() => {
    const ownedCount = Object.keys(records).length;
    const totalCount = initialMasterData.length;
    return { ownedCount, totalCount, percentage: totalCount ? Math.round((ownedCount / totalCount) * 100) : 0 };
  }, [records, initialMasterData]);

  if (!schema) return <div className="text-center p-10 text-[var(--plana-primary)] animate-pulse">Loading...</div>;

  return (
    <div className="space-y-6 slide-in-right-anim">
      <div className="bg-white/90 rounded-2xl p-6 border border-[var(--plana-border)] backdrop-blur-md shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 clip-diagonal">
        <div>
          <h2 className="text-2xl font-black text-[var(--plana-text-main)] flex items-center gap-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--plana-primary-dark)] to-[var(--plana-accent)]">
              {mode === 'collection' ? '내 컬렉션' : '전체 도감'}
            </span> {mode === 'collection' ? '현황' : '목록'}
          </h2>
          <p className="text-[var(--plana-text-muted)] mt-1 font-medium">총 {stats.totalCount}명의 학생 중 {stats.ownedCount}명을 보유하고 있습니다. ({stats.percentage}%)</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {mode === 'collection' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-[var(--plana-primary)] hover:bg-[var(--plana-accent)] text-white font-bold px-6 py-2 rounded-xl transition-all shadow-[0_4px_15px_rgba(188,163,240,0.4)] whitespace-nowrap clip-diagonal"
            >
              + 학생 등록
            </button>
          )}
          <div className="w-full md:w-64 h-3 bg-slate-100 rounded-full overflow-hidden border border-[var(--plana-border)] relative">
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-accent)] transition-all duration-1000 ease-out" style={{ width: `${stats.percentage}%` }} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`grid gap-3 bg-white/80 p-3 rounded-xl border border-[var(--plana-border)] backdrop-blur-sm shadow-sm ${mode === 'collection' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--plana-primary)]" size={16} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="이름 또는 번호 검색" className="w-full bg-white border border-[var(--plana-border)] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[var(--plana-text-main)] focus:outline-none focus:border-[var(--plana-accent)] focus:ring-1 focus:ring-[var(--plana-accent)] transition-all" />
        </div>
        <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className="bg-white border border-[var(--plana-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--plana-text-main)] focus:outline-none focus:border-[var(--plana-accent)] appearance-none shadow-sm cursor-pointer">
          <option value="">모든 학교</option>
          {schema.enums.School?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-white border border-[var(--plana-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--plana-text-main)] focus:outline-none focus:border-[var(--plana-accent)] appearance-none shadow-sm cursor-pointer">
          <option value="">모든 역할</option>
          {schema.enums.Role?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>
        <select value={filterFieldType} onChange={e => setFilterFieldType(e.target.value)} className="bg-white border border-[var(--plana-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--plana-text-main)] focus:outline-none focus:border-[var(--plana-accent)] appearance-none shadow-sm cursor-pointer">
          <option value="">모든 포지션</option>
          {schema.enums.FieldType?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>) || (
            <>
              <option value="Striker">스트라이커</option>
              <option value="Special">스페셜</option>
            </>
          )}
        </select>
        {mode === 'collection' && (
          <div className="flex bg-slate-50 border border-[var(--plana-border)] rounded-lg p-1">
            {[{v: 'owned', l: '보유'}, {v: 'unowned', l: '미보유'}].map(o => (
              <button key={o.v} onClick={() => setFilterOwned(o.v as any)} className={`flex-1 text-xs font-bold rounded-md transition-colors ${filterOwned === o.v ? 'bg-[var(--plana-primary)] text-white shadow-sm' : 'text-[var(--plana-text-muted)] hover:text-[var(--plana-primary-dark)]'}`}>
                {o.l}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        {filteredData.map(master => {
          const isOwned = !!records[master.id];
          const record = records[master.id];
          const schoolLabel = schema.enums.School?.values?.find(v => v.key === master.school)?.label || master.school;
          const portraitUrl = master.portraitUrls?.[0] || '';

          return (
            <Link key={master.id} href={mode === 'collection' ? `/student/detail?id=${master.id}` : `/archive/student/detail?id=${master.id}`} prefetch={false} className="block group">
              <div className={`relative bg-white rounded-xl overflow-hidden border transition-all duration-300 clip-diagonal shadow-[0_4px_10px_rgba(188,163,240,0.1)] ${(mode === 'archive' || isOwned) ? 'border-[var(--plana-primary-light)] hover:border-[var(--plana-accent)] hover:shadow-[0_8px_20px_rgba(255,166,201,0.3)] hover:-translate-y-1' : 'border-slate-200 opacity-60 hover:opacity-100 grayscale hover:grayscale-0'}`}>
                <div className="aspect-square bg-slate-50 relative flex items-end justify-center overflow-hidden">
                  <span className="absolute top-2 left-2 text-[10px] font-black text-white bg-[var(--plana-primary-dark)]/80 px-2 py-0.5 rounded backdrop-blur-sm z-10 shadow-sm">
                    {isOwned && record?.level ? `Lv.${record.level}` : `No.${master.studentNumber || '-'}`}
                  </span>
                  
                  {portraitUrl ? (
                    <img src={`https://api.planaai.kro.kr${portraitUrl}`} className="w-full h-full object-cover object-bottom transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <span className="text-xs text-[var(--plana-text-muted)] font-bold">No Image</span>
                    </div>
                  )}
                  {(mode === 'archive' || isOwned) && (
                    <div className="absolute bottom-2 right-2 flex gap-0.5 z-10 bg-white/50 backdrop-blur-md px-1.5 py-0.5 rounded-full shadow-sm pointer-events-none">
                      {Array.from({ length: mode === 'collection' ? (record?.currentStars || master.starNum) : master.starNum }).map((_, i) => (
                        <Star key={i} size={10} className="fill-yellow-400 text-yellow-400 drop-shadow-sm" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white border-t border-[var(--plana-border)] relative">
                  {mode === 'collection' && (
                    <div className="absolute -top-3 right-2">
                      {isOwned ? (
                        <CheckCircle size={20} className="text-[var(--plana-accent)] bg-white rounded-full border border-white shadow-sm" />
                      ) : (
                        <Circle size={20} className="text-slate-300 bg-white rounded-full border border-white" />
                      )}
                    </div>
                  )}
                  <h3 className="font-bold text-[var(--plana-text-main)] text-sm truncate pr-6">{master.name}</h3>
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-[10px] text-[var(--plana-primary-dark)] bg-[var(--plana-primary-light)]/30 px-1.5 py-0.5 rounded border border-[var(--plana-primary-light)] truncate max-w-[80px]">{schoolLabel}</span>
                    {master.club && <span className="text-[10px] text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded border border-pink-200 truncate max-w-[60px]">{master.club}</span>}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      
      {filteredData.length === 0 && (
        <div className="text-center py-20">
          <p className="text-[var(--plana-text-muted)] font-medium">검색 결과가 없습니다.</p>
        </div>
      )}

      {schema && (
        <RegistrationModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          masterData={initialMasterData} 
          schema={schema} 
        />
      )}
    </div>
  );
}
