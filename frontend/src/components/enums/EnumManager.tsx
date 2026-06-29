import React, { useState } from 'react';
import axios from 'axios';
import { Tag, ChevronDown, X, Plus } from 'lucide-react';
import type { SchemaConfig } from '../../types';
import { API } from '../../constants';

interface EnumManagerProps {
  schema: SchemaConfig;
  showToast: (m: string, t?: 'error') => void;
  onRefresh: () => void;
}

export function EnumManager({ schema, showToast, onRefresh }: EnumManagerProps) {
  const [openEnum, setOpenEnum] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = async (enumKey: string) => {
    if (!newKey.trim() || !newLabel.trim()) {
      showToast('ID와 표시 이름 모두 입력해주세요', 'error');
      return;
    }
    try {
      await axios.post(`${API}/api/schema/enums/${enumKey}/values`, { key: newKey.trim(), label: newLabel.trim() });
      showToast(`'${newLabel.trim()}' 추가 완료`);
      setNewKey('');
      setNewLabel('');
      onRefresh();
    } catch (e: any) {
      showToast(e.response?.data?.error === 'Duplicate key' ? '이미 존재하는 ID입니다' : '추가 실패', 'error');
    }
  };

  const handleDelete = async (enumKey: string, valueKey: string, valueLabel: string) => {
    if (!window.confirm(`'${valueLabel}' 삭제하시겠습니까?\n이 값을 사용 중인 학생 데이터가 있다면 연결이 깨질 수 있습니다.`)) return;
    try {
      await axios.delete(`${API}/api/schema/enums/${enumKey}/values/${valueKey}`);
      showToast(`'${valueLabel}' 삭제 완료`);
      onRefresh();
    } catch {
      showToast('삭제 실패', 'error');
    }
  };

  const enumEntries = Object.entries(schema.enums || {});

  return (
    <div className="bg-emerald-900/20 p-5 rounded-xl border border-emerald-500/20 mt-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-emerald-300 flex items-center gap-2"><Tag size={20} /> 공통 아이콘 관리</h2>
        <p className="text-sm text-emerald-200/70 mt-1">학교, 역할, 속성 등의 선택 가능한 공통 항목을 추가·삭제할 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {enumEntries.map(([enumKey, enumDef]) => (
          <div key={enumKey} className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
            <button
              onClick={() => setOpenEnum(openEnum === enumKey ? null : enumKey)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{enumDef.label}</span>
                <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">{enumKey}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{enumDef.values.length}개</span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${openEnum === enumKey ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {openEnum === enumKey && (
              <div className="border-t border-slate-700/50 p-3 space-y-2 animate-fade-in">
                <div className="flex flex-wrap gap-1.5">
                  {enumDef.values.map(v => (
                    <div key={v.key} className="flex items-center gap-1 bg-slate-900/60 border border-slate-700 rounded-lg px-2.5 py-1.5 group">
                      <span className="text-xs text-white font-medium">{v.label}</span>
                      <span className="text-[9px] text-slate-500 font-mono">({v.key})</span>
                      <button
                        onClick={() => handleDelete(enumKey, v.key, v.label)}
                        className="ml-1 p-0.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
                      ><X size={12} /></button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-700/30">
                  <input
                    value={newKey} onChange={e => setNewKey(e.target.value)}
                    placeholder="ID (영문)" className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    onFocus={() => { if (openEnum !== enumKey) setOpenEnum(enumKey); }}
                  />
                  <input
                    value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    placeholder="표시 이름" className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(enumKey); }}
                  />
                  <button
                    onClick={() => handleAdd(enumKey)}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                  ><Plus size={14} /> 추가</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
