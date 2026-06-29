import { useState } from 'react';
import axios from 'axios';
import { Database, Plus, Edit, Trash2, Image as ImageIcon, PlusCircle, MinusCircle } from 'lucide-react';
import type { SchemaConfig, Equipment } from '../../types';
import { API, TIER_BORDER } from '../../constants';
import { TierIconUpload } from '../ui';

interface EquipmentManagerProps {
  schema: SchemaConfig;
  onRefresh: () => void;
  showToast: (m: string, t?: 'error') => void;
}

export function EquipmentManager({ schema, onRefresh, showToast }: EquipmentManagerProps) {
  const emptyEquipment: Equipment = { key: '', label: '', tiers: [] };
  const [modal, setModal] = useState<{ equipment: Equipment; isNew: boolean } | null>(null);

  const handleSave = async (equipment: Equipment, isNew: boolean) => {
    try {
      if (isNew) await axios.post(`${API}/api/schema/equipments`, equipment);
      else await axios.put(`${API}/api/schema/equipments/${equipment.key}`, equipment);
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
      await axios.delete(`${API}/api/schema/equipments/${key}`);
      showToast('삭제되었습니다.');
      onRefresh();
    } catch {
      showToast('오류 발생', 'error');
    }
  };

  const addTier = () => {
    if (!modal) return;
    const newTierLevel = modal.equipment.tiers.length + 1;
    const newTier = { name: `T${newTierLevel} ${modal.equipment.label}`, iconUrl: '' };
    setModal({
      ...modal,
      equipment: {
        ...modal.equipment,
        tiers: [...modal.equipment.tiers, newTier]
      }
    });
  };

  const removeLastTier = () => {
    if (!modal || modal.equipment.tiers.length === 0) return;
    setModal({
      ...modal,
      equipment: {
        ...modal.equipment,
        tiers: modal.equipment.tiers.slice(0, -1)
      }
    });
  };

  return (
    <div className="space-y-6 animate-slide-in">
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold text-white mb-6 shrink-0">{modal.isNew ? '신규 장비 그룹 추가' : `✏️ 장비 그룹 수정`}</h2>
            <div className="space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">고유 ID (영문, 예: Hat, Gloves)</label>
                <input value={modal.equipment.key} disabled={!modal.isNew} onChange={e => setModal({...modal, equipment: {...modal.equipment, key: e.target.value}})} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">장비 이름 (예: 모자)</label>
                <input value={modal.equipment.label} onChange={e => setModal({...modal, equipment: {...modal.equipment, label: e.target.value}})} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="pt-2 border-t border-slate-800 mt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-semibold text-slate-400 uppercase">티어별 장비 설정 (현재 {modal.equipment.tiers.length}티어)</label>
                  <div className="flex gap-2">
                    <button onClick={removeLastTier} disabled={modal.equipment.tiers.length === 0} className="text-red-400 hover:text-red-300 disabled:opacity-50 p-1">
                      <MinusCircle size={16} />
                    </button>
                    <button onClick={addTier} className="text-emerald-400 hover:text-emerald-300 p-1">
                      <PlusCircle size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {modal.equipment.tiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-3 bg-slate-800/30 p-2 rounded-lg border border-slate-700/50">
                      <span className="text-[10px] font-black w-10 text-center bg-slate-800 py-1.5 rounded border border-slate-700 text-slate-300 flex-shrink-0">
                        T{i + 1}
                      </span>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[8px] text-slate-500 font-bold">완제품</span>
                        <TierIconUpload url={tier.iconUrl || ''} onChange={url => {
                          const newTiers = [...modal.equipment.tiers]; newTiers[i] = { ...newTiers[i], iconUrl: url };
                          setModal({...modal, equipment: {...modal.equipment, tiers: newTiers}});
                        }} showToast={showToast} />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[8px] text-slate-500 font-bold">설계도</span>
                        <TierIconUpload url={tier.blueprintIconUrl || ''} onChange={url => {
                          const newTiers = [...modal.equipment.tiers]; newTiers[i] = { ...newTiers[i], blueprintIconUrl: url };
                          setModal({...modal, equipment: {...modal.equipment, tiers: newTiers}});
                        }} showToast={showToast} />
                      </div>
                      <input value={tier.name || ''} onChange={e => {
                        const newTiers = [...modal.equipment.tiers]; newTiers[i] = { ...newTiers[i], name: e.target.value };
                        setModal({...modal, equipment: {...modal.equipment, tiers: newTiers}});
                      }} className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none ml-2" placeholder={`예: T${i+1} ${modal.equipment.label || '장비'}`} />
                    </div>
                  ))}
                  {modal.equipment.tiers.length === 0 && (
                    <div className="text-xs text-slate-500 text-center py-4 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
                      우측 상단의 + 버튼을 눌러 티어를 추가하세요.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 shrink-0 pt-4 border-t border-slate-800">
              <button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors">취소</button>
              <button onClick={() => handleSave(modal.equipment, modal.isNew)} className="bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors">저장하기</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-emerald-900/20 p-5 rounded-xl border border-emerald-500/20">
        <div>
          <h2 className="text-xl font-bold text-emerald-300 flex items-center gap-2"><Database size={20} /> 장비 마스터 데이터 관리</h2>
          <p className="text-sm text-emerald-200/70 mt-1">장비 타입(모자, 가방 등)과 T1부터 끝없는 티어별 이미지 및 이름을 관리합니다.</p>
        </div>
        <button onClick={() => setModal({ equipment: emptyEquipment, isNew: true })} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg text-white">
          <Plus size={18} /> 새 장비 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schema.equipments?.map(e => (
          <div key={e.key} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 relative group flex flex-col h-[280px]">
            <div className="flex justify-between items-start mb-4 shrink-0">
              <div>
                <span className="text-[10px] font-black text-slate-500 tracking-wider uppercase">{e.key}</span>
                <h3 className="text-lg font-bold text-white mt-0.5">{e.label}</h3>
              </div>
              <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setModal({ equipment: e, isNew: false })} className="text-blue-400 hover:text-blue-300 p-1 bg-blue-900/30 rounded"><Edit size={14} /></button>
                <button onClick={() => handleDelete(e.key)} className="text-red-400 hover:text-red-300 p-1 bg-red-900/30 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700/30 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {e.tiers.map((t, i) => (
                <div key={i} className="text-xs text-slate-300 flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-500 w-5">T{i+1}</span>
                  {t.iconUrl ? <img src={`${API}${t.iconUrl}`} className={`w-6 h-6 object-cover rounded bg-slate-800 border ${TIER_BORDER[Math.min(i, TIER_BORDER.length - 1)]}`} /> : <div className={`w-6 h-6 rounded bg-slate-800 border ${TIER_BORDER[Math.min(i, TIER_BORDER.length - 1)]} flex items-center justify-center`}><ImageIcon size={12} className="text-slate-600" /></div>}
                  <span className="flex-1 truncate">{t.name || `T${i+1} 장비`}</span>
                </div>
              ))}
              {e.tiers.length === 0 && <div className="text-xs text-slate-500">등록된 티어가 없습니다.</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
