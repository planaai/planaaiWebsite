'use client';

import React, { useState } from 'react';
import { Database, Trash2, ShieldAlert, Settings as SettingsIcon, LogOut, AlertTriangle, UserMinus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { deleteCollectionFromServer } from '@/lib/api';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'general' | 'data'>('data');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClearItem = (key: string, name: string) => {
    if (confirm(`정말로 ${name} 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      localStorage.removeItem(key);
      toast.success(`${name} 데이터가 초기화되었습니다. 변경사항을 적용하기 위해 페이지를 새로고침합니다.`);
      window.location.reload();
    }
  };

  const handleClearAllLocal = () => {
    if (confirm('모든 로컬 스토리지 데이터(편성, 플래너, 보유 학생, 로그인 정보 등)를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다!')) {
      const keys = ['formation-storage', 'planner-storage', 'ba-personal-archive', 'auth_token'];
      keys.forEach(key => localStorage.removeItem(key));
      toast.success('모든 로컬 데이터가 초기화되었습니다. 페이지를 새로고침합니다.');
      window.location.reload();
    }
  };

  const handleDeleteServerCollection = async () => {
    if (!isAuthenticated) return;
    const confirmMessage = '⚠️ [주의] 서버에 저장된 내 컬렉션 데이터를 모두 삭제하시겠습니까?\n(로컬 데이터는 유지됩니다. 정말 삭제하시려면 확인을 눌러주세요.)';
    if (confirm(confirmMessage)) {
      setIsDeleting(true);
      try {
        await deleteCollectionFromServer();
        toast.success('서버 컬렉션 데이터가 성공적으로 삭제되었습니다.');
      } catch (error) {
        console.error('Delete server collection error:', error);
        toast.error('잠시 후에 다시 시도해 주세요');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8 border-b pb-4 border-slate-200">
        <div className="w-12 h-12 bg-[var(--plana-primary)] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(255,105,180,0.4)]">
          <SettingsIcon className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">설정</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 flex-shrink-0">
          <nav className="flex flex-col space-y-2">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'general' ? 'bg-[var(--plana-primary)] text-white shadow-md font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <SettingsIcon className="w-5 h-5 mr-3" />
              일반
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`flex items-center px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'data' ? 'bg-[var(--plana-primary)] text-white shadow-md font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Database className="w-5 h-5 mr-3" />
              데이터 관리
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {activeTab === 'general' && (
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-6">일반 설정</h2>
              
              <div className="p-8 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center text-center">
                <SettingsIcon className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700">준비 중인 기능입니다</h3>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">데이터 관리</h2>
              <p className="text-slate-500 mb-8 text-sm">
                브라우저(로컬 스토리지)에 저장된 임시 데이터를 관리하거나, 계정과 연동된 서버 데이터를 삭제할 수 있습니다.
              </p>

              <div className="space-y-6">
                
                {/* Local Storage Section */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Database className="w-4 h-4 text-slate-400" />
                    로컬 스토리지 데이터
                  </h3>
                  
                  <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200">
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-slate-800">학생 편성 기록</p>
                        <p className="text-sm text-slate-500 mt-0.5">저장된 모의 편성 파티 데이터</p>
                      </div>
                      <button onClick={() => handleClearItem('formation-storage', '학생 편성')} className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> 비우기
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-slate-800">학생 성장 플래너</p>
                        <p className="text-sm text-slate-500 mt-0.5">작성 중인 재화 파밍 플랜</p>
                      </div>
                      <button onClick={() => handleClearItem('planner-storage', '성장 플래너')} className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> 비우기
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-slate-800">보유 학생 아카이브</p>
                        <p className="text-sm text-slate-500 mt-0.5">개인 학생 풀 (로컬 캐시)</p>
                      </div>
                      <button onClick={() => handleClearItem('ba-personal-archive', '아카이브')} className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> 비우기
                      </button>
                    </div>

                    {isAuthenticated && (
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium text-slate-800">로그인 토큰</p>
                          <p className="text-sm text-slate-500 mt-0.5">현재 기기의 계정 연동 정보</p>
                        </div>
                        <button onClick={() => { logout(); toast.success('로그아웃 되었습니다.'); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2">
                          <LogOut className="w-4 h-4" /> 로그아웃
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {/* Account / Server Data Section (Only visible if logged in) */}
                {isAuthenticated && (
                  <section>
                    <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mt-8 mb-4 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" />
                      서버 데이터 관리 (로그인 한정)
                    </h3>
                    <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-800">내 컬렉션 데이터 삭제</p>
                        <p className="text-sm text-red-600/80 mt-0.5">서버에 저장된 모든 학생 보유 및 성급 정보를 삭제합니다.</p>
                      </div>
                      <button 
                        onClick={handleDeleteServerCollection}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        {isDeleting ? '삭제 중...' : <><UserMinus className="w-4 h-4" /> 서버 데이터 삭제</>}
                      </button>
                    </div>
                  </section>
                )}

                {/* Danger Zone */}
                <section>
                  <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mt-8 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Danger Zone
                  </h3>
                  <div className="bg-white border-2 border-red-100 rounded-xl p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-red-700">모든 로컬 데이터 전체 초기화</p>
                        <p className="text-sm text-red-500/80 mt-1">
                          현재 기기에 저장된 모든 플래나 데이터를 삭제하고 초기 상태로 되돌립니다.
                        </p>
                      </div>
                      <button onClick={handleClearAllLocal} className="whitespace-nowrap px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
                        <Trash2 className="w-5 h-5" /> 전체 초기화
                      </button>
                    </div>
                  </div>
                </section>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
