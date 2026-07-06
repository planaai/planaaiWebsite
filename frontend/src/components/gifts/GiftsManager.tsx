import { useState, useMemo } from 'react';
import axios from 'axios';
import { Database, Plus, Edit, Trash2, Image as ImageIcon, Search } from 'lucide-react';
import type { SchemaConfig, Gift, ArchiveData } from '../../types';
import { API } from '../../constants';
import { TierIconUpload } from '../ui';

interface GiftsManagerProps {
  schema: SchemaConfig;
  data: ArchiveData[];
  onRefresh: () => void;
  showToast: (m: string, t?: 'error') => void;
}

export function GiftsManager({ schema, data, onRefresh, showToast }: GiftsManagerProps) {
  const emptyGift: Gift = {
    key: '',
    name: '',
    tier: 'Normal',
    description: '',
    iconUrl: '',
    affinity: { level2: [], level3: [], level4: [] }
  };
  
  const [modal, setModal] = useState<{ gift: Gift; isNew: boolean } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const masterStudents = useMemo(() => data.map(d => d.master).sort((a, b) => a.name.localeCompare(b.name)), [data]);

  const handleSave = async (gift: Gift, isNew: boolean) => {
    if (!gift.key || !gift.name) {
      return showToast('고유 ID와 이름은 필수입니다.', 'error');
    }
    try {
      if (isNew) await axios.post(`${API}/api/schema/gifts`, gift);
      else await axios.put(`${API}/api/schema/gifts/${gift.key}`, gift);
      showToast(`저장 성공!`);
      setModal(null);
      onRefresh();
    } catch {
      showToast('오류 발생', 'error');
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API}/api/schema/gifts/${key}`);
      showToast('삭제되었습니다.');
      onRefresh();
    } catch {
      showToast('오류 발생', 'error');
    }
  };

  const toggleAffinity = (studentId: number, level: 'level2' | 'level3' | 'level4') => {
    if (!modal) return;
    const newGift = { ...modal.gift, affinity: { ...modal.gift.affinity } };
    
    // 제거 (이미 있으면)
    if (newGift.affinity[level].includes(studentId)) {
      newGift.affinity[level] = newGift.affinity[level].filter(id => id !== studentId);
    } else {
      // 다른 레벨에 있다면 제거
      newGift.affinity.level2 = newGift.affinity.level2.filter(id => id !== studentId);
      newGift.affinity.level3 = newGift.affinity.level3.filter(id => id !== studentId);
      newGift.affinity.level4 = newGift.affinity.level4.filter(id => id !== studentId);
      // 추가
      newGift.affinity[level].push(studentId);
    }
    setModal({ ...modal, gift: newGift });
  };

  const filteredStudents = masterStudents.filter(s => {
    if (searchTerm.trim() === '') {
      return modal?.gift.affinity.level2.includes(s.id) || 
             modal?.gift.affinity.level3.includes(s.id) || 
             modal?.gift.affinity.level4.includes(s.id);
    }
    return s.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-slide-in">
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl p-6 flex flex-col md:flex-row gap-6 h-full max-h-[90vh]">
            
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-4">
              <h2 className="text-xl font-bold text-white mb-6">{modal.isNew ? '🎁 신규 선물 추가' : `✏️ 선물 수정`}</h2>
              
              <div className="flex gap-4">
                <div className="flex flex-col gap-1.5 flex-1 justify-center">
                  <label className="text-xs font-semibold text-slate-400 uppercase">선물 이름</label>
                  <input value={modal.gift.name} onChange={e => setModal({...modal, gift: {...modal.gift, name: e.target.value}})} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none" placeholder="예: 곰 인형" />
                </div>
                <div className="flex flex-col gap-1.5 w-24">
                  <label className="text-xs font-semibold text-slate-400 uppercase text-center">이미지 업로드</label>
                  <div className="flex justify-center">
                    <TierIconUpload url={modal.gift.iconUrl} onChange={url => setModal({...modal, gift: {...modal.gift, iconUrl: url}})} showToast={showToast} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">고유 ID (영문/숫자)</label>
                <input value={modal.gift.key} disabled={!modal.isNew} onChange={e => setModal({...modal, gift: {...modal.gift, key: e.target.value}})} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none disabled:opacity-50" placeholder="GIFT_001" />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">선물 등급</label>
                <select value={modal.gift.tier} onChange={e => setModal({...modal, gift: {...modal.gift, tier: e.target.value as 'Normal'|'HighGrade'}})} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none">
                  <option value="Normal">일반 (상급 아이템)</option>
                  <option value="HighGrade">고급 (고급 아이템)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">설명</label>
                <textarea value={modal.gift.description} onChange={e => setModal({...modal, gift: {...modal.gift, description: e.target.value}})} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none h-20 resize-none" placeholder="선물에 대한 간단한 설명..." />
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-700">
                <button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors">취소</button>
                <button onClick={() => handleSave(modal.gift, modal.isNew)} className="bg-pink-600 hover:bg-pink-500 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors">저장하기</button>
              </div>
            </div>

            <div className="flex-1 border-l border-slate-700 pl-6 flex flex-col h-full min-h-0">
              <h3 className="text-sm font-bold text-white mb-2">학생 호감도 할당 (2/3/4 단계만)</h3>
              <div className="relative mb-4 shrink-0">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="학생 이름 검색..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-pink-500 focus:outline-none"
                />
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {filteredStudents.map(student => {
                  const isLv2 = modal.gift.affinity.level2.includes(student.id);
                  const isLv3 = modal.gift.affinity.level3.includes(student.id);
                  const isLv4 = modal.gift.affinity.level4.includes(student.id);
                  const anySelected = isLv2 || isLv3 || isLv4;

                  return (
                    <div key={student.id} className={`flex items-center justify-between p-2 rounded-lg border ${anySelected ? 'border-pink-500/50 bg-pink-500/10' : 'border-slate-700/50 bg-slate-800/30'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-900 flex-shrink-0 border border-slate-600">
                          {student.portraitUrls && student.portraitUrls.length > 0 ? <img src={`${API}${student.portraitUrls[0]}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-500">No Img</div>}
                        </div>
                        <span className="text-sm font-bold text-white">{student.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => toggleAffinity(student.id, 'level2')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${isLv2 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Lv.2</button>
                        <button onClick={() => toggleAffinity(student.id, 'level3')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${isLv3 ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Lv.3</button>
                        <button onClick={() => toggleAffinity(student.id, 'level4')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${isLv4 ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Lv.4</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-pink-900/20 p-5 rounded-xl border border-pink-500/20">
        <div>
          <h2 className="text-xl font-bold text-pink-400 flex items-center gap-2"><Database size={20} /> 선물 DB 관리</h2>
          <p className="text-sm text-pink-200/70 mt-1">호감도 상승에 필요한 선물 아이템 및 학생별 선호도를 관리합니다.</p>
        </div>
        <button onClick={() => { setModal({ gift: emptyGift, isNew: true }); setSearchTerm(''); }} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg text-white">
          <Plus size={18} /> 새 선물 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {schema.gifts?.map(g => (
          <div key={g.key} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 relative group flex gap-4 items-center">
            <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-600 flex-shrink-0 flex items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-slate-800 text-[9px] px-1 py-0.5 rounded-bl-lg font-bold border-l border-b border-slate-600 text-slate-300">
                {g.tier === 'Normal' ? '일반' : '고급'}
              </div>
              {g.iconUrl ? <img src={`${API}${g.iconUrl}`} className="w-12 h-12 object-contain drop-shadow-md" /> : <ImageIcon size={20} className="text-slate-600" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-black text-slate-500 tracking-wider uppercase truncate pr-2">{g.key}</span>
                <div className="flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setModal({ gift: JSON.parse(JSON.stringify(g)), isNew: false }); setSearchTerm(''); }} className="text-blue-400 hover:text-blue-300"><Edit size={14} /></button>
                  <button onClick={() => handleDelete(g.key)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                </div>
              </div>
              <h3 className="text-base font-bold text-white truncate">{g.name}</h3>
              <div className="flex gap-2 mt-2 text-[10px] font-bold text-slate-400">
                <span className="bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">Lv.2: {g.affinity.level2.length}명</span>
                <span className="bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">Lv.3: {g.affinity.level3.length}명</span>
                <span className="bg-pink-900/30 text-pink-400 px-1.5 py-0.5 rounded border border-pink-500/20">Lv.4: {g.affinity.level4.length}명</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
