'use client';

import React, { useEffect, useState } from 'react';
import { getCachedServerData } from '@/lib/dataCache';
import type { StudentMaster } from '@/types';
import { MasterDataEditor } from '@/components/admin/MasterDataEditor';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminPage() {
  const [masterData, setMasterData] = useState<StudentMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { masterData } = await getCachedServerData();
      setMasterData(masterData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveStudent = async (updatedStudent: StudentMaster) => {
    try {
      const res = await api.put(`/master/students/${updatedStudent.id}`, updatedStudent);
      
      // Update local state
      setMasterData(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    } catch (error: any) {
      throw new Error(`서버 응답 오류: ${error.response?.status || error.message}`);
    }
  };

  const filteredData = masterData.filter(s => {
    if (!searchQuery) return true;
    return s.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedStudent = masterData.find(s => s.id === selectedStudentId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-[var(--plana-primary)] rounded-full animate-spin"></div>
        <p className="mt-4 text-[var(--plana-primary)] font-bold animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 p-4">
      {/* Sidebar: Student List */}
      <div className="w-80 bg-white rounded-2xl shadow-lg border border-[var(--plana-border)] flex flex-col h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-black text-lg text-slate-800 mb-3">학생 마스터 데이터</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="학생 이름 검색..." 
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[var(--plana-primary)] focus:ring-1 focus:ring-[var(--plana-primary)]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredData.map(student => (
            <button
              key={student.id}
              onClick={() => setSelectedStudentId(student.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors flex items-center justify-between ${selectedStudentId === student.id ? 'bg-[var(--plana-primary)] text-white font-bold shadow-md' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              <span>{student.name}</span>
              <span className={`text-xs ${selectedStudentId === student.id ? 'text-white/80' : 'text-slate-400'}`}>ID: {student.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Editor */}
      <div className="flex-1 min-w-0">
        {selectedStudent ? (
          <MasterDataEditor 
            key={selectedStudent.id} 
            student={selectedStudent} 
            onSave={handleSaveStudent} 
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl shadow-lg border border-[var(--plana-border)] text-slate-400">
            <Search size={48} className="mb-4 opacity-50" />
            <p className="font-bold text-lg">왼쪽 목록에서 학생을 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
