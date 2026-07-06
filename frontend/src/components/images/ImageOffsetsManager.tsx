import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Search, RefreshCw, User, Image as ImageIcon } from 'lucide-react';
import { API } from '../../constants';
import type { ArchiveData } from '../../types';

interface Props {
  data: ArchiveData[];
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface OffsetConfig {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function ImageOffsetsManager({ data, showToast }: Props) {
  const [offsets, setOffsets] = useState<Record<string, OffsetConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<ArchiveData | null>(null);

  // Default values to use when a student doesn't have an offset config yet
  const DEFAULT_CONFIG: OffsetConfig = { scale: 200, offsetX: 0, offsetY: 20 };

  useEffect(() => {
    fetchOffsets();
  }, []);

  const fetchOffsets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/image-offsets`);
      setOffsets(res.data || {});
    } catch (err) {
      console.error(err);
      showToast('오프셋 데이터를 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/api/image-offsets`, offsets);
      showToast('성공적으로 저장되었습니다.', 'success');
    } catch (err) {
      console.error(err);
      showToast('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (name: string, key: keyof OffsetConfig, value: number) => {
    setOffsets(prev => {
      const existing = prev[name] || { ...DEFAULT_CONFIG };
      return {
        ...prev,
        [name]: { ...existing, [key]: value }
      };
    });
  };

  // Only show Strikers since Specials use portrait by default
  const filteredData = data
    .filter(s => s.master.fieldType === 'Striker')
    .filter(s => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return s.master.name.toLowerCase().includes(q);
    });

  const activeConfig = selectedStudent 
    ? (offsets[selectedStudent.master.name] || DEFAULT_CONFIG) 
    : DEFAULT_CONFIG;

  const getImageUrl = (url: string) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `${API}${url}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <RefreshCw className="animate-spin mr-2" /> 로딩 중...
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Sidebar: Student List */}
      <div className="w-80 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col h-full">
        <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
          <span>학생 목록 (Striker)</span>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            저장
          </button>
        </h2>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="학생 이름 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
          {filteredData.map(student => (
            <button
              key={student.master.id}
              onClick={() => setSelectedStudent(student)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                selectedStudent?.master.id === student.master.id ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30' : 'text-slate-300 hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              <span>{student.master.name}</span>
              {offsets[student.master.name] && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 rounded">Edited</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Main: Preview and Controls */}
      <div className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 flex flex-col">
        {selectedStudent ? (
          <div className="flex gap-8 h-full">
            {/* Preview Box */}
            <div className="flex-none bg-white rounded-lg p-8 shadow-inner overflow-hidden relative flex flex-col items-center justify-center border-4 border-slate-300">
              <h3 className="absolute top-2 left-2 text-slate-400 font-bold text-sm z-50 mix-blend-difference">미리보기 (모의 편성 비율)</h3>
              
              {/* Dummy TeamSlot Container */}
              <div className="relative flex flex-col items-center justify-end shrink-0 w-[160px] h-[350px] bg-slate-100 rounded shadow-md mt-4">
                <div className="absolute inset-0 pb-[80px] flex items-end justify-center pointer-events-none overflow-visible">
                  {selectedStudent.master.fullIllustUrl ? (
                    <img
                      src={getImageUrl(selectedStudent.master.fullIllustUrl)}
                      alt={selectedStudent.master.name}
                      className="max-w-none object-cover drop-shadow-xl transition-all duration-75"
                      style={{ 
                        width: `200%`,
                        transform: `translate(${activeConfig.offsetX}%, ${activeConfig.offsetY}%)`,
                        objectPosition: 'center 20%' 
                      }}
                    />
                  ) : (
                    <div className="w-[100px] h-[100px] bg-slate-200 rounded-full flex items-center justify-center mb-8">
                      <User size={48} className="text-slate-400" />
                    </div>
                  )}
                </div>

                {/* Dummy Floating Info Badge */}
                <div className="absolute bottom-0 w-[115%] bg-white rounded shadow-lg z-20 skew-x-[-10deg] border-b-4 border-red-500 h-[70px]">
                  <div className="w-full text-center mt-4 font-bold text-slate-800 skew-x-[10deg]">{selectedStudent.master.name}</div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex-1 flex flex-col gap-6 p-4">
              <div>
                <h3 className="text-2xl font-black text-white mb-1">{selectedStudent.master.name}</h3>
                <p className="text-slate-400 text-sm">이미지 크기와 위치를 조정하세요. (미리보기 화면에 실시간으로 반영됩니다)</p>
              </div>

              <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                {/* OffsetX Slider */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-bold text-slate-300">좌우 위치 (OffsetX)</label>
                    <span className="text-blue-400 font-mono font-bold bg-blue-900/30 px-2 rounded">{activeConfig.offsetX}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="-100" max="100" step="1"
                    value={activeConfig.offsetX}
                    onChange={(e) => updateConfig(selectedStudent.master.name, 'offsetX', parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>-100% (Left)</span><span>0%</span><span>+100% (Right)</span>
                  </div>
                </div>

                {/* OffsetY Slider */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-bold text-slate-300">상하 위치 (OffsetY)</label>
                    <span className="text-blue-400 font-mono font-bold bg-blue-900/30 px-2 rounded">{activeConfig.offsetY}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="-100" max="100" step="1"
                    value={activeConfig.offsetY}
                    onChange={(e) => updateConfig(selectedStudent.master.name, 'offsetY', parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>-100% (Up)</span><span>0%</span><span>+100% (Down)</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto flex justify-end gap-2">
                <button 
                  onClick={() => {
                    if (confirm('기본값으로 초기화하시겠습니까? (저장 전까지는 반영되지 않습니다)')) {
                       updateConfig(selectedStudent.master.name, 'scale', 200);
                       updateConfig(selectedStudent.master.name, 'offsetX', DEFAULT_CONFIG.offsetX);
                       updateConfig(selectedStudent.master.name, 'offsetY', DEFAULT_CONFIG.offsetY);
                    }
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <ImageIcon size={48} className="opacity-20 mb-4" />
            <p>좌측에서 이미지를 조절할 학생을 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
