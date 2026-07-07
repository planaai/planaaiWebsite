import React, { useRef, useState } from 'react';
import axios from 'axios';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';
import { API } from '../../constants';
import type { Skill } from '../../types';
import { ImagePickerModal } from '../images/ImagePickerModal';
import { TextInput, TextAreaInput } from './TextInput';

interface SkillInputProps {
  typeLabel: string;
  skill: Skill;
  onChange: (s: Skill) => void;
  showToast: (m: string, t?: 'error') => void;
  hideName?: boolean;
}

export function SkillInput({ typeLabel, skill, onChange, showToast, hideName }: SkillInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const matches = Array.from(skill.descriptionTemplate?.matchAll(/\{(\d+)\}/g) || []).map(m => m[1]);
  const uniqueVars = Array.from(new Set(matches)).sort((a, b) => parseInt(a) - parseInt(b));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('icon', file);
    setUploading(true);
    try {
      const res = await axios.post(`${API}/api/upload/skill-icon`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onChange({ ...skill, iconUrl: res.data.url });
    } catch {
      showToast('이미지 업로드 실패', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-3">
      <div className="flex gap-4">
        <div className="w-20 flex-shrink-0 flex flex-col gap-2 items-center">
          <label className="text-[10px] font-bold text-slate-400 uppercase">{typeLabel}</label>
          <div
            className="relative w-16 h-16 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center overflow-hidden group cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            {skill.iconUrl ? (
              <img src={`${API}${skill.iconUrl}`} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
            ) : (
              <ImageIcon className="text-slate-500 group-hover:text-blue-400 transition-colors" size={24} />
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <UploadCloud size={20} className="text-white" />
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
          <button onClick={() => setShowPicker(true)} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold bg-blue-900/20 px-2 py-1 rounded w-full border border-blue-500/20 text-center">DB에서 선택</button>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {!hideName && (
            <TextInput
              value={skill.name}
              onChange={v => onChange({ ...skill, name: v })}
              placeholder="스킬 이름"
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors w-full"
            />
          )}
          <TextAreaInput
            value={skill.descriptionTemplate}
            onChange={v => onChange({ ...skill, descriptionTemplate: v })}
            placeholder="스킬 설명 (예: 공격력의 {1}% 데미지)"
            rows={2}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors w-full resize-none"
          />
        </div>
      </div>
      {uniqueVars.length > 0 && (
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 flex flex-col gap-2">
          <div className="text-[10px] text-slate-400 font-bold uppercase">레벨별 파라미터 (콤마 구분)</div>
          {uniqueVars.map(v => (
            <div key={v} className="flex items-center gap-2">
              <span className="text-blue-400 font-bold text-xs bg-blue-900/30 px-2 py-1 rounded border border-blue-500/30">{`{${v}}`}</span>
              <TextInput
                value={((skill.parameters || {})[v] || []).join(', ')}
                onChange={val =>
                  onChange({
                    ...skill,
                    parameters: {
                      ...(skill.parameters || {}),
                      [v]: val.split(',').map(s => s.trim())
                    }
                  })
                }
                placeholder="예: 13.9, 14.6, 15.3, ..."
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors flex-1"
              />
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-700/50 pt-2 mt-1">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-slate-400 font-bold uppercase hover:text-white transition-colors flex items-center gap-1"
        >
          {showAdvanced ? '▼ 고급 설정 숨기기' : '▶ 고급 설정 (T.S/특수 기믹)'}
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-2 gap-3 bg-slate-900/30 p-3 rounded-lg border border-slate-700/50">
            <div className="flex flex-col gap-1.5 col-span-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">발동 주체 (Caster)</label>
              <select
                className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                value={skill.caster || ''}
                onChange={e => onChange({ ...skill, caster: e.target.value as any || undefined })}
              >
                <option value="">본체 (기본)</option>
                <option value="Self">Self (명시적)</option>
                <option value="Summon">Summon (소환수)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">발동 주기 (초)</label>
              <input
                type="number"
                className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                value={skill.activationCycle || ''}
                onChange={e => onChange({ ...skill, activationCycle: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="예: 8"
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">조건 (Condition)</label>
              <TextInput
                value={skill.condition || ''}
                onChange={v => onChange({ ...skill, condition: v || undefined })}
                placeholder="예: WhileSummonActive"
                className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-1 justify-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skill.auraEffect || false}
                  onChange={e => onChange({ ...skill, auraEffect: e.target.checked })}
                  className="w-3.5 h-3.5 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 font-bold uppercase">오라(Aura) 효과</span>
              </label>
            </div>
            <div className="col-span-2 border-t border-slate-700/50 mt-1 pt-2 flex flex-col gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase">트리거 & 이펙트</span>
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  value={skill.trigger?.event || ''}
                  onChange={v => onChange({ ...skill, trigger: { ...(skill.trigger || {}), event: v } })}
                  placeholder="트리거 이벤트 (예: OnSkillActivated)"
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={skill.trigger?.requiredCount || ''}
                  onChange={e => onChange({ ...skill, trigger: { ...(skill.trigger || {}), requiredCount: e.target.value ? Number(e.target.value) : undefined } })}
                  placeholder="요구 스택 수 (예: 5)"
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <TextInput
                  value={skill.effect?.type || ''}
                  onChange={v => onChange({ ...skill, effect: { ...(skill.effect || {}), type: v } })}
                  placeholder="이펙트 종류 (예: CostReduction)"
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={skill.effect?.amount || ''}
                  onChange={e => onChange({ ...skill, effect: { ...(skill.effect || {}), amount: e.target.value ? Number(e.target.value) : undefined } })}
                  placeholder="적용 수치 (예: 3)"
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      {showPicker && <ImagePickerModal onSelect={val => onChange({ ...skill, iconUrl: val })} onClose={() => setShowPicker(false)} />}
    </div>
  );
}
