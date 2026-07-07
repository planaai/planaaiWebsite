'use client';

import React, { useState, useEffect } from 'react';
import type { StudentMaster, SkillSet, Skill } from '@/types';
import { Save, Plus, Trash2, Image as ImageIcon } from 'lucide-react';

interface Props {
  student: StudentMaster;
  onSave: (updatedStudent: StudentMaster) => Promise<void>;
}

export function MasterDataEditor({ student, onSave }: Props) {
  const [formData, setFormData] = useState<StudentMaster>(student);
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');
  const [rawJson, setRawJson] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(student);
    setRawJson(JSON.stringify(student, null, 2));
  }, [student]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let dataToSave = formData;
      if (activeTab === 'raw') {
        dataToSave = JSON.parse(rawJson);
      }
      await onSave(dataToSave);
      alert('저장되었습니다.');
    } catch (e) {
      alert('저장 실패: ' + (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSkillSet = () => {
    const newSkillSet: SkillSet = {
      modeName: `모드 ${formData.skills ? formData.skills.length + 1 : 1}`,
      ex: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
      normal: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
      passive: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
      sub: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }
    };
    setFormData(prev => ({ ...prev, skills: [...(prev.skills || []), newSkillSet] }));
  };

  const handleRemoveSkillSet = (index: number) => {
    if (confirm('이 스킬셋을 삭제하시겠습니까?')) {
      setFormData(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
    }
  };

  const updateSkillSet = (index: number, field: string, value: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    setFormData(prev => {
      const newSkills = [...prev.skills];
      newSkills[index] = { ...newSkills[index], [field]: value };
      return { ...prev, skills: newSkills };
    });
  };

  const updateSkill = (setIndex: number, skillType: 'ex' | 'normal' | 'passive' | 'sub', field: keyof Skill, value: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    setFormData(prev => {
      const newSkills = [...prev.skills];
      const skillObj = newSkills[setIndex][skillType];
      
      if (Array.isArray(skillObj)) {
        const newSkillArr = [...skillObj];
        if (newSkillArr[0]) {
           newSkillArr[0] = { ...newSkillArr[0], [field]: value };
        }
        newSkills[setIndex] = { ...newSkills[setIndex], [skillType]: newSkillArr };
      } else {
        newSkills[setIndex] = { ...newSkills[setIndex], [skillType]: { ...(skillObj as Skill), [field]: value } };
      }
      return { ...prev, skills: newSkills };
    });
  };

  const renderSkillForm = (setIndex: number, skillType: 'ex' | 'normal' | 'passive' | 'sub', title: string) => {
    const skillDataRaw = formData.skills[setIndex][skillType];
    const skillData = Array.isArray(skillDataRaw) ? skillDataRaw[0] : (skillDataRaw as Skill);
    if (!skillData) return null;

    return (
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
        <h4 className="font-bold text-slate-800 mb-3">{title}</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">스킬 이름</label>
            <input 
              type="text" 
              value={skillData.name || ''} 
              onChange={e => updateSkill(setIndex, skillType, 'name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">설명 템플릿</label>
            <textarea 
              value={skillData.descriptionTemplate || ''} 
              onChange={e => updateSkill(setIndex, skillType, 'descriptionTemplate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">아이콘 URL</label>
            <input 
              type="text" 
              value={skillData.iconUrl || ''} 
              onChange={e => updateSkill(setIndex, skillType, 'iconUrl', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">파라미터 (JSON 배열)</label>
            <textarea 
              value={JSON.stringify(skillData.parameters || {}, null, 2)} 
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateSkill(setIndex, skillType, 'parameters', parsed);
                } catch (err) {
                  // Allow invalid typing temporarily
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-32 font-mono"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-[var(--plana-border)] flex flex-col h-full max-h-[85vh]">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
        <h2 className="text-xl font-black text-slate-800">
          마스터 데이터 편집: <span className="text-[var(--plana-primary)]">{student.name}</span>
        </h2>
        <div className="flex gap-2">
          <div className="bg-slate-200 p-1 rounded-lg flex gap-1 mr-4">
            <button 
              onClick={() => setActiveTab('visual')}
              className={`px-4 py-1.5 rounded-md font-bold text-sm transition-colors ${activeTab === 'visual' ? 'bg-white shadow-sm text-[var(--plana-primary)]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              스킬 시각 편집
            </button>
            <button 
              onClick={() => setActiveTab('raw')}
              className={`px-4 py-1.5 rounded-md font-bold text-sm transition-colors ${activeTab === 'raw' ? 'bg-white shadow-sm text-[var(--plana-primary)]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              전체 JSON 편집
            </button>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[var(--plana-primary)] hover:bg-[var(--plana-accent)] text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save size={16} /> {isSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'raw' ? (
          <textarea
            value={rawJson}
            onChange={e => setRawJson(e.target.value)}
            className="w-full h-full min-h-[600px] p-4 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--plana-primary)]"
          />
        ) : (
          <div className="space-y-8">
            {formData.skills?.map((skillSet, idx) => (
              <div key={idx} className="border-2 border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-black text-lg text-slate-700">스킬셋 {idx + 1}</h3>
                  <button onClick={() => handleRemoveSkillSet(idx)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <div className="p-5 bg-white space-y-6">
                  {/* Basic Mode Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">모드 이름 (modeName)</label>
                      <input 
                        type="text" 
                        value={skillSet.modeName || ''} 
                        onChange={e => updateSkillSet(idx, 'modeName', e.target.value)}
                        placeholder="예: 공격형"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">초상화 경로 (portraitUrl)</label>
                      <div className="relative">
                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          value={skillSet.portraitUrl || ''} 
                          onChange={e => updateSkillSet(idx, 'portraitUrl', e.target.value)}
                          placeholder="/uploads/portraits/..."
                          className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">전신 일러스트 경로 (fullIllustUrl)</label>
                      <div className="relative">
                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          value={skillSet.fullIllustUrl || ''} 
                          onChange={e => updateSkillSet(idx, 'fullIllustUrl', e.target.value)}
                          placeholder="/uploads/illusts/..."
                          className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {renderSkillForm(idx, 'ex', 'EX 스킬')}
                    {renderSkillForm(idx, 'normal', '기본 스킬')}
                    {renderSkillForm(idx, 'passive', '강화 스킬')}
                    {renderSkillForm(idx, 'sub', '서브 스킬')}
                  </div>
                </div>
              </div>
            ))}

            <button 
              onClick={handleAddSkillSet}
              className="w-full py-4 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:border-[var(--plana-primary)] hover:text-[var(--plana-primary)] transition-colors bg-slate-50 hover:bg-slate-50/50"
            >
              <Plus size={20} /> 새 스킬셋 추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
