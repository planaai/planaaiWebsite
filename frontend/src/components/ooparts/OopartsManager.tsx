import React, { useState } from 'react';
import axios from 'axios';
import { Database, Plus, Edit, Trash2, Image as ImageIcon } from 'lucide-react';
import type { SchemaConfig } from '../../types';
import { API, TIER_COLORS, TIER_BORDER, PREFIX } from '../../constants';
import { TierIconUpload } from '../ui';

interface OopartsManagerProps {
  schema: SchemaConfig;
  onRefresh: () => void;
  showToast: (m: string, t?: 'error') => void;
}

export function OopartsManager({ schema, onRefresh, showToast }: OopartsManagerProps) {
  const emptyOopart = { key: '', label: '', tiers: [{name:'', iconUrl:''}, {name:'', iconUrl:''}, {name:'', iconUrl:''}, {name:'', iconUrl:''}] };
  const [modal, setModal] = useState<{ oopart: typeof emptyOopart; isNew: boolean } | null>(null);

  const handleSave = async (oopart: typeof emptyOopart, isNew: boolean) => {
    try {
      if (isNew) await axios.post(`${API}/api/schema/ooparts`, oopart);
      else await axios.put(`${API}/api/schema/ooparts/${oopart.key}`, oopart);
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
      await axios.delete(`${API}/api/schema/ooparts/${key}`);
      showToast('삭제되었습니다.');
      onRefresh();
    } catch {
      showToast('오류 발생', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-slide-in">
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">{modal.isNew ? '신규 오파츠 그룹 추가' : `✏️ 오파츠 그룹 수정`}</h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">고유 ID (영문)</label>
                <input value={modal.oopart.key} disabled={!modal.isNew} onChange={e => setModal({...modal, oopart: {...modal.oopart, key: e.target.value}})} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">오파츠 그룹 이름 (예: 안티키테라 장치)</label>
                <input value={modal.oopart.label} onChange={e => setModal({...modal, oopart: {...modal.oopart, label: e.target.value}})} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="pt-2">
                <label className="text-xs font-semibold text-slate-400 uppercase">등급별 이름 및 아이콘 설정</label>
                <div className="grid grid-cols-1 gap-3 mt-2">
                  {['기초', '일반', '고급', '최상급'].map((prefix, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold w-12 text-center bg-slate-800 py-1.5 rounded border border-slate-700 ${TIER_COLORS[i]} flex-shrink-0`}>{prefix}</span>
                      <TierIconUpload url={modal.oopart.tiers[i]?.iconUrl || ''} onChange={url => {
                        const newTiers = [...modal.oopart.tiers]; newTiers[i] = { ...newTiers[i], iconUrl: url };
                        setModal({...modal, oopart: {...modal.oopart, tiers: newTiers}});
                      }} showToast={showToast} />
                      <input value={modal.oopart.tiers[i]?.name || ''} onChange={e => {
                        const newTiers = [...modal.oopart.tiers]; newTiers[i] = { ...newTiers[i], name: e.target.value };
                        setModal({...modal, oopart: {...modal.oopart, tiers: newTiers}});
                      }} className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none" placeholder={`예: ${PREFIX[i]} ${modal.oopart.label || '오파츠'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors">취소</button>
              <button onClick={() => handleSave(modal.oopart, modal.isNew)} className="bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors">저장하기</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-amber-900/20 p-5 rounded-xl border border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-amber-300 flex items-center gap-2"><Database size={20} /> 오파츠 그룹 관리</h2>
          <p className="text-sm text-amber-200/70 mt-1">마스터 데이터에서 선택할 오파츠 종류와 등급별 이미지, 정식 이름을 일괄 관리합니다.</p>
        </div>
        <button onClick={() => setModal({ oopart: emptyOopart, isNew: true })} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg text-white">
          <Plus size={18} /> 새 오파츠 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schema.ooparts?.map(o => (
          <div key={o.key} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 relative group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-black text-slate-500 tracking-wider uppercase">{o.key}</span>
                <h3 className="text-lg font-bold text-white mt-0.5">{o.label}</h3>
              </div>
              <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setModal({ oopart: o as typeof emptyOopart, isNew: false })} className="text-blue-400 hover:text-blue-300 p-1 bg-blue-900/30 rounded"><Edit size={14} /></button>
                <button onClick={() => handleDelete(o.key)} className="text-red-400 hover:text-red-300 p-1 bg-red-900/30 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700/30">
              {o.tiers.map((t, i) => (
                <div key={i} className="text-xs text-slate-300 flex items-center gap-2">
                  {t.iconUrl ? <img src={`${API}${t.iconUrl}`} className={`w-6 h-6 object-cover rounded bg-slate-800 border ${TIER_BORDER[i]}`} /> : <div className={`w-6 h-6 rounded bg-slate-800 border ${TIER_BORDER[i]} flex items-center justify-center`}><ImageIcon size={12} className="text-slate-600" /></div>}
                  <span className="flex-1 truncate">{t.name || `(${PREFIX[i]} 오파츠)`}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
