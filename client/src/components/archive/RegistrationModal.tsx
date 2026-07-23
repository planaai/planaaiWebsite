'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, ChevronDown, ChevronUp, Save, Upload, Edit3, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { StudentMaster, SchemaConfig, ArchiveRecord } from '@/types';
import { useArchiveStore } from '@/store/archiveStore';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterData: StudentMaster[];
  schema: SchemaConfig;
  initialEditRecord?: ArchiveRecord; // For editing an existing record
}

type RegistrationForm = Partial<ArchiveRecord> & { 
  _localId: number; 
  _isCollapsed: boolean;
};

export function RegistrationModal({ isOpen, onClose, masterData, schema, initialEditRecord }: RegistrationModalProps) {
  const [mounted, setMounted] = useState(false);
  const [forms, setForms] = useState<RegistrationForm[]>([]);
  const [nextId, setNextId] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize forms when modal opens
  React.useEffect(() => {
    setMounted(true);
    if (isOpen) {
      if (initialEditRecord) {
        setForms([{ ...initialEditRecord, _localId: 0, _isCollapsed: false }]);
      } else {
        setForms([{ _localId: 0, _isCollapsed: false }]);
        setNextId(1);
      }
    }
  }, [isOpen, initialEditRecord]);

  if (!isOpen || !mounted) return null;

  const handleAddForm = () => {
    // Collapse all existing
    setForms(prev => [
      ...prev.map(f => ({ ...f, _isCollapsed: true })),
      { _localId: nextId, _isCollapsed: false }
    ]);
    setNextId(prev => prev + 1);
  };

  const handleUpdateForm = (localId: number, field: string, value: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    setForms(prev => prev.map(f => {
      if (f._localId === localId) {
        // Handle nested fields like stats.maxHP or skillLevels.ex
        if (field.includes('.')) {
          const [obj, key] = field.split('.');
          return { ...f, [obj]: { ...(f as any)[obj], [key]: value } };
        }
        if (field === 'studentId' && typeof value === 'number') {
          const master = masterData.find(m => m.id === value);
          if (master) {
            return { ...f, [field]: value, currentStars: master.starNum || 1 };
          }
        }
        return { ...f, [field]: value };
      }
      return f;
    }));
  };

  const toggleCollapse = (localId: number) => {
    setForms(prev => prev.map(f => f._localId === localId ? { ...f, _isCollapsed: !f._isCollapsed } : f));
  };
  const removeForm = (localId: number) => {
    setForms(prev => prev.filter(f => f._localId !== localId));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const validForms = forms.filter(f => f.studentId && f.level);
      if (validForms.length === 0) return;

      const payloads = validForms.map(f => {
        const { _localId, _isCollapsed, ...rest } = f;
        return {
          ...rest,
          level: rest.level || 1,
          currentStars: rest.currentStars || 1,
          skillLevels: rest.skillLevels || { ex: 1, normal: 1, passive: 1, sub: 1 },
          equipment: rest.equipment || { slot1: null, slot2: null, slot3: null, slot4: null },
          stats: rest.stats || {},
        };
      });

      const store = useArchiveStore.getState();
      payloads.forEach(p => store.setRecord(p.studentId!, p as ArchiveRecord));
      
      // Force sync to server if authenticated
      if (typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
        store.syncToServer().catch(console.error);
      }

      onClose();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };



  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[var(--plana-border)] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[var(--plana-border)] bg-slate-50">
          <h2 className="text-xl font-black text-[var(--plana-text-main)] flex items-center gap-2">
            {initialEditRecord ? '학생 정보 수정' : '새로운 학생 등록'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-[var(--plana-accent)] transition-colors">
            <X size={24} />
          </button>
        </div>



        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50">
          {forms.length > 0 && (
            <div className="space-y-4">
              {forms.map((form, index) => {


                const selectedMaster = masterData.find(m => m.id === form.studentId);
                
                return (
                  <div key={form._localId} className="bg-white border border-[var(--plana-border)] rounded-xl overflow-hidden transition-all duration-300 shadow-sm">
                    {/* Accordion Header */}
                    <div 
                      className={`flex justify-between items-center p-4 cursor-pointer hover:bg-slate-50 ${form._isCollapsed ? '' : 'border-b border-[var(--plana-border)] bg-slate-50/50'}`}
                      onClick={() => toggleCollapse(form._localId)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                          {selectedMaster?.portraitUrls && selectedMaster.portraitUrls.length > 0 ? (
                            <img src={`https://api.planaai.kro.kr${selectedMaster.portraitUrls[0]}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">?</div>
                          )}
                        </div>
                        <span className="font-bold text-[var(--plana-text-main)]">
                          {selectedMaster ? selectedMaster.name : '학생을 선택해주세요'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">

                        {!initialEditRecord && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeForm(form._localId); }}
                            className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded bg-red-50 hover:bg-red-100"
                          >
                            삭제
                          </button>
                        )}
                        {form._isCollapsed ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronUp size={20} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* Accordion Body */}
                    {!form._isCollapsed && (
                      <div className="p-5 flex flex-col xl:flex-row gap-6">
                        <div className="w-full space-y-6">
                          {/* 1. Student Selection */}
                        <div>
                          <label className="block text-xs font-bold text-[var(--plana-primary-dark)] mb-2">학생 선택</label>
                          <select 
                            value={form.studentId || ''} 
                            onChange={(e) => handleUpdateForm(form._localId, 'studentId', parseInt(e.target.value))}
                            className="w-full bg-white border border-[var(--plana-border)] rounded-lg px-4 py-3 text-[var(--plana-text-main)] focus:outline-none focus:border-[var(--plana-accent)]"
                            disabled={!!initialEditRecord}
                          >
                            <option value="">-- 학생 선택 --</option>
                            {masterData.map(m => (
                              <option key={m.id} value={m.id}>[{m.school}] {m.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Basic Info */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-[var(--plana-primary-dark)] mb-2">레벨</label>
                            <input 
                              type="number" min={1} max={90} value={form.level || ''} 
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                handleUpdateForm(form._localId, 'level', isNaN(val) ? undefined : val);
                              }} 
                              className="w-full bg-white border border-[var(--plana-border)] rounded-lg px-4 py-2 text-[var(--plana-text-main)] focus:border-[var(--plana-accent)] focus:outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-[var(--plana-primary-dark)] mb-2">성급</label>
                            <select value={form.currentStars || 3} onChange={(e) => handleUpdateForm(form._localId, 'currentStars', parseInt(e.target.value))} className="w-full bg-white border border-[var(--plana-border)] rounded-lg px-4 py-2 text-[var(--plana-text-main)] focus:border-[var(--plana-accent)] focus:outline-none">
                              {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}성</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-[var(--plana-primary-dark)] mb-2">인연 랭크</label>
                            <input 
                              type="number" min={1} max={100} value={form.bondRank || ''} 
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                handleUpdateForm(form._localId, 'bondRank', isNaN(val) ? undefined : val);
                              }} 
                              className="w-full bg-white border border-[var(--plana-border)] rounded-lg px-4 py-2 text-[var(--plana-text-main)] focus:border-[var(--plana-accent)] focus:outline-none" 
                            />
                          </div>
                        </div>

                        {/* 3. Skills */}
                        <div>
                          <label className="block text-xs font-bold text-[var(--plana-primary-dark)] mb-2">스킬 레벨 (EX / 기본 / 강화 / 서브)</label>
                          <div className="grid grid-cols-4 gap-4">
                            {['ex', 'normal', 'passive', 'sub'].map((sk) => (
                              <input 
                                key={sk}
                                type="number" 
                                min={1} 
                                max={sk === 'ex' ? 5 : 10} 
                                placeholder={sk.toUpperCase()}
                                value={form.skillLevels?.[sk as keyof typeof form.skillLevels] || ''} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  handleUpdateForm(form._localId, `skillLevels.${sk}`, isNaN(val) ? undefined : val);
                                }} 
                                className="w-full bg-white border border-[var(--plana-border)] rounded-lg px-4 py-2 text-[var(--plana-text-main)] text-center focus:border-[var(--plana-accent)] focus:outline-none" 
                              />
                            ))}
                          </div>
                        </div>

                        {/* 4. Equipment & Weapon */}
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-xs font-bold text-[var(--plana-primary-dark)] mb-2">장비 (티어 / 레벨)</label>
                            <div className="grid grid-cols-1 gap-2">
                              {['slot1', 'slot2', 'slot3'].map((eq, idx) => (
                                <div key={eq} className="flex gap-2">
                                  <div className="flex-1 flex items-center bg-white border border-[var(--plana-border)] rounded-lg overflow-hidden focus-within:border-[var(--plana-accent)]">
                                    <span className="text-xs text-[var(--plana-primary-dark)] font-bold px-2 bg-[var(--plana-primary-light)]/30 h-full flex items-center">T</span>
                                    <input 
                                      type="number" min={1} max={9}
                                      placeholder="티어"
                                      value={form.equipment?.[eq as keyof typeof form.equipment]?.tier || ''}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        handleUpdateForm(form._localId, `equipment.${eq}`, { ...form.equipment?.[eq as keyof typeof form.equipment], tier: isNaN(val) ? undefined : val, level: form.equipment?.[eq as keyof typeof form.equipment]?.level || 1 })
                                      }}
                                      className="w-full bg-transparent px-2 py-2 text-[var(--plana-text-main)] text-sm focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex-1 flex items-center bg-white border border-[var(--plana-border)] rounded-lg overflow-hidden focus-within:border-[var(--plana-accent)]">
                                    <span className="text-xs text-[var(--plana-primary-dark)] font-bold px-2 bg-[var(--plana-primary-light)]/30 h-full flex items-center">Lv</span>
                                    <input 
                                      type="number" min={1} max={90}
                                      placeholder="레벨"
                                      value={form.equipment?.[eq as keyof typeof form.equipment]?.level || ''}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        handleUpdateForm(form._localId, `equipment.${eq}`, { ...form.equipment?.[eq as keyof typeof form.equipment], tier: form.equipment?.[eq as keyof typeof form.equipment]?.tier || 1, level: isNaN(val) ? undefined : val })
                                      }}
                                      className="w-full bg-transparent px-2 py-2 text-[var(--plana-text-main)] text-sm focus:outline-none"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-[var(--plana-primary-dark)] mb-2">전용 무기 (성급 / 레벨)</label>
                            <div className="flex gap-2">
                              <select 
                                value={form.uniqueWeapon?.stars || 1} 
                                onChange={(e) => handleUpdateForm(form._localId, 'uniqueWeapon', { ...form.uniqueWeapon, stars: parseInt(e.target.value), level: form.uniqueWeapon?.level || 1 })} 
                                className="flex-1 bg-white border border-[var(--plana-border)] rounded-lg px-3 py-2 text-[var(--plana-text-main)] focus:border-[var(--plana-accent)] focus:outline-none"
                              >
                                <option value={1}>1성</option>
                                <option value={2}>2성</option>
                                <option value={3}>3성</option>
                                <option value={4}>4성</option>
                              </select>
                              <input 
                                type="number" min={1} max={50} placeholder="무기 레벨"
                                value={form.uniqueWeapon?.level || ''}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  handleUpdateForm(form._localId, 'uniqueWeapon', { ...form.uniqueWeapon, stars: form.uniqueWeapon?.stars || 1, level: isNaN(val) ? undefined : val });
                                }}
                                className="flex-1 bg-white border border-[var(--plana-border)] rounded-lg px-3 py-2 text-[var(--plana-text-main)] focus:border-[var(--plana-accent)] focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 5. Stats & Potential */}
                        <div>
                          <label className="block text-xs font-bold text-[var(--plana-primary-dark)] mb-2">상세 스탯 및 능력 개방</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                              { k: 'maxHP', l: '체력' },
                              { k: 'attackPower', l: '공격력' },
                              { k: 'defensePower', l: '방어력' },
                              { k: 'healPower', l: '치유력' },
                            ].map(st => (
                              <div key={st.k} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-xs text-[var(--plana-text-muted)] mb-1 font-bold">{st.l}</div>
                                <input 
                                  type="number" placeholder="스탯 값"
                                  value={form.stats?.[st.k] || ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    handleUpdateForm(form._localId, `stats.${st.k}`, isNaN(val) ? undefined : val);
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-[var(--plana-text-main)] mb-2 focus:border-[var(--plana-accent)] focus:outline-none"
                                />
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-pink-600 bg-pink-100 px-1 rounded font-bold whitespace-nowrap">능력 개방</span>
                                  <input 
                                    type="number" min={0} max={25} placeholder="Lv"
                                    value={form.potentialLevels?.[st.k] || ''}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      handleUpdateForm(form._localId, `potentialLevels.${st.k}`, isNaN(val) || val <= 0 ? undefined : val);
                                    }}
                                    className="w-full bg-white border border-pink-200 rounded px-2 py-1 text-xs text-[var(--plana-text-main)] focus:border-pink-400 focus:outline-none"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!initialEditRecord && (
                <button 
                  onClick={handleAddForm}
                  className="w-full py-4 border-2 border-dashed border-[var(--plana-border)] rounded-xl text-[var(--plana-primary-dark)] font-bold hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-text-main)] transition-colors flex items-center justify-center gap-2 bg-white/50"
                >
                  <Plus size={20} /> 계속해서 다른 학생 추가하기
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[var(--plana-border)] bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg font-bold text-[var(--plana-text-muted)] hover:bg-slate-200 transition-colors">
            취소
          </button>
          <button 
            onClick={handleSaveAll}
            disabled={
              isSaving || 
              forms.filter(f => f.studentId || f.level).length === 0 || 
              forms.filter(f => f.studentId || f.level).some(f => !f.studentId || !f.level)
            }
            className="px-8 py-2.5 bg-[var(--plana-primary)] hover:bg-[var(--plana-accent)] text-white font-black rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_10px_rgba(188,163,240,0.3)]"
          >
            <Save size={18} /> {isSaving ? '저장 중...' : (initialEditRecord ? '수정 내용 저장' : '모두 저장')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
