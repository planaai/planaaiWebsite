'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useArchiveStore } from '@/store/archiveStore';
import { toast } from 'sonner';

export default function SyncPanel() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const { lastSyncTimes, syncToServer, fetchFromServer, autoSyncEnabled } = useArchiveStore();
  const lastSyncTime = user?.uid && lastSyncTimes ? lastSyncTimes[user.uid.toString()] : null;
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const [isOpen, setIsOpen] = useState(false);

  if (!isAuthenticated) return null;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncToServer();
      toast.success('서버에 데이터가 안전하게 저장되었습니다.');
    } catch (error) {
      toast.error('잠시 후에 다시 시도해 주세요');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetch = async () => {
    if (!window.confirm('서버의 데이터로 로컬 데이터를 덮어씌웁니다. 계속하시겠습니까?')) {
      return;
    }
    
    setIsFetching(true);
    try {
      await fetchFromServer();
      toast.success('서버에서 데이터를 성공적으로 가져왔습니다.');
    } catch (error) {
      toast.error('잠시 후에 다시 시도해 주세요');
    } finally {
      setIsFetching(false);
    }
  };

  const formattedTime = lastSyncTime 
    ? new Date(lastSyncTime).toLocaleString('ko-KR')
    : '동기화 기록 없음';

  return (
    <div className="mb-6 border rounded-xl shadow-sm bg-slate-50 border-slate-200 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-slate-800">데이터 동기화</h3>
          {!isOpen && lastSyncTime && (
            <span className="text-xs text-slate-400 ml-4 font-normal">마지막 동기화: {formattedTime}</span>
          )}
        </div>
        <div className="text-slate-400">
          {isOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500 mb-4">
            로컬 기기에 저장된 컬렉션 데이터를 서버에 안전하게 보관합니다.
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex space-x-3">
              <button 
                onClick={handleSync}
                disabled={isSyncing || isFetching}
                className={`px-4 py-2 text-white font-medium rounded-md transition-colors ${isSyncing ? 'bg-pink-300 cursor-not-allowed' : 'bg-[var(--plana-primary)] hover:bg-pink-400'}`}
              >
                {isSyncing ? '저장 중...' : '서버에 저장하기'}
              </button>
              <button 
                onClick={handleFetch}
                disabled={isSyncing || isFetching}
                className={`px-4 py-2 text-white font-medium rounded-md transition-colors ${isFetching ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
              >
                {isFetching ? '가져오는 중...' : '서버에서 가져오기'}
              </button>
            </div>
            <div className="text-sm text-slate-500 text-right">
              마지막 동기화: {formattedTime}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
