import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Image as ImageIcon, Users, Upload, Download, RefreshCw, MessageSquare, Target } from 'lucide-react';

import type { ArchiveData, SchemaConfig } from './types';
import { API } from './constants';
import { Toast } from './components/ui/Toast';
import { MasterManager } from './components/master/MasterManager';
import { OopartsManager } from './components/ooparts/OopartsManager';
import { EquipmentManager } from './components/equipments/EquipmentManager';
import { GiftsManager } from './components/gifts/GiftsManager';
import { ImageDBManager } from './components/images/ImageDBManager';
import { ImageOffsetsManager } from './components/images/ImageOffsetsManager';
import { GachaAdminManager } from './components/gacha/GachaAdminManager';
import { NoticeManager } from './components/notice/NoticeManager';
import { InquiryAdminManager } from './components/inquiries/InquiryAdminManager';
import { RaidAdminManager } from './components/raids/RaidAdminManager';
import { AdminLogin } from './components/auth/AdminLogin';

export default function App() {
  const [activeTab, setActiveTab] = useState<'master' | 'ooparts' | 'equipments' | 'images' | 'imageOffsets' | 'gifts' | 'gacha' | 'notices' | 'inquiries' | 'raids'>('master');
  const [data, setData] = useState<ArchiveData[]>([]);
  const [schema, setSchema] = useState<SchemaConfig | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  const fetchData = async () => {
    try {
      const [resData, resSchema] = await Promise.all([
        axios.get(`${API}/api/archive`),
        axios.get(`${API}/api/schema`)
      ]);
      setData(resData.data.data || resData.data);
      setSchema(resSchema.data);
    } catch {
      showToast('데이터를 불러오는데 실패했습니다.', 'error');
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      setIsAuthenticated(false);
      return;
    }
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await axios.get(`${API}/api/auth/me`);
      if (res.data?.user?.role === 'ADMIN') {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem('admin_token');
        delete axios.defaults.headers.common['Authorization'];
      }
    } catch {
      setIsAuthenticated(false);
      localStorage.removeItem('admin_token');
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('admin_token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setIsAuthenticated(true);
    fetchData(); // Fetch data after login
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await axios.get(`${API}/api/master/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'master_data_export.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('내보내기 완료');
    } catch {
      showToast('내보내기 실패', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/api/master/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('가져오기 완료');
      fetchData();
    } catch {
      showToast('가져오기 실패', 'error');
    }
    e.target.value = '';
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <RefreshCw size={32} className="text-blue-500 animate-spin" />
          <p className="text-blue-400 font-bold">인증 정보 확인 중...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  if (!schema) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <RefreshCw size={32} className="text-blue-500 animate-spin" />
          <p className="text-blue-400 font-bold">서버와 연결 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-blue-500/30">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('master')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover:shadow-[0_0_20px_rgba(59,130,246,0.7)] transition-all">
              <Database size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
              BlueArchive <span className="text-blue-400">Tracker</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => {
              localStorage.removeItem('admin_token');
              delete axios.defaults.headers.common['Authorization'];
              setIsAuthenticated(false);
            }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 transition-colors mr-2">
              로그아웃
            </button>
            <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors disabled:opacity-50">
              <Download size={14} /> JSON 내보내기
            </button>
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer">
              <Upload size={14} /> JSON 가져오기
              <input type="file" className="hidden" accept=".json" onChange={handleImport} />
            </label>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-slate-800/50 rounded-xl mb-8 w-fit border border-slate-700/50 backdrop-blur-sm shadow-inner overflow-x-auto max-w-full">
          {[ { id: 'master', icon: Users, label: '마스터 데이터 관리', color: 'blue' },
             { id: 'ooparts', icon: Database, label: '오파츠 DB', count: schema.ooparts?.length || 0, color: 'amber' },
             { id: 'equipments', icon: Database, label: '장비 관리', count: schema.equipments?.length || 0, color: 'emerald' },
             { id: 'gifts', icon: Database, label: '선물 DB', count: schema.gifts?.length || 0, color: 'pink' },
             { id: 'images', icon: ImageIcon, label: '이미지 풀', color: 'purple' },
             { id: 'imageOffsets', icon: ImageIcon, label: '이미지 비율 조절', color: 'cyan' },
             { id: 'gacha', icon: RefreshCw, label: '가챠 유지보수', color: 'indigo' },
             { id: 'notices', icon: MessageSquare, label: '공지사항 관리', color: 'sky' },
             { id: 'inquiries', icon: MessageSquare, label: '문의사항 관리', color: 'rose' },
             { id: 'raids', icon: Target, label: '보스 관리', color: 'orange' }
          ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap
                  ${activeTab === tab.id ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-500/20` : 'text-slate-400 hover:text-white hover:bg-slate-700/50'} `}>
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

        {/* Tab Contents */}
        <div className="relative">
          {activeTab === 'master' && <MasterManager data={data} schema={schema} onRefresh={fetchData} showToast={showToast} />}
          {activeTab === 'ooparts' && <OopartsManager schema={schema} onRefresh={fetchData} showToast={showToast} />}
          {activeTab === 'equipments' && <EquipmentManager schema={schema} onRefresh={fetchData} showToast={showToast} />}
          {activeTab === 'gifts' && <GiftsManager schema={schema} data={data} onRefresh={fetchData} showToast={showToast} />}
          {activeTab === 'images' && <ImageDBManager data={data} schema={schema} onRefresh={fetchData} showToast={showToast} />}
          {activeTab === 'imageOffsets' && <ImageOffsetsManager data={data} showToast={showToast} />}
          {activeTab === 'gacha' && <GachaAdminManager showToast={showToast} />}
          { activeTab === 'notices' && <NoticeManager /> }
          { activeTab === 'inquiries' && <InquiryAdminManager showToast={showToast} /> }
          { activeTab === 'raids' && <RaidAdminManager showToast={showToast} /> }
        </div>
      </main>
    </div>
  );
}
