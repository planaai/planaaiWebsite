import React from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Minus, Plus, Zap, RotateCcw } from 'lucide-react';
import { getEquipMaxLevel, getWeaponMaxLevel, SKILL_MAX } from '@/lib/equipmentUtils';
import { getImageUrl } from './utils';

interface PlannerEditFormProps {
  editingPlan: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  setEditingPlan: (plan: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => void;
  onSave: (plan: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => void;
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  onMax?: () => void;
  disabled?: boolean;
}

function NumberStepper({ value, min, max, onChange, onMax, disabled }: StepperProps) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div
      className={`inline-flex items-center bg-white border border-[var(--plana-border)] rounded-lg overflow-hidden focus-within:border-[var(--plana-primary-dark)] transition-colors shadow-2xs ${disabled ? 'opacity-40 pointer-events-none' : ''
        }`}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className="px-2 py-1.5 text-slate-500 hover:bg-pink-50 hover:text-[var(--plana-primary-dark)] disabled:opacity-30 transition-colors"
        aria-label="감소"
      >
        <Minus size={12} />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value) || min))}
        className="w-10 bg-transparent py-1 text-center text-sm font-bold text-slate-800 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="px-2 py-1.5 text-slate-500 hover:bg-pink-50 hover:text-[var(--plana-primary-dark)] disabled:opacity-30 transition-colors"
        aria-label="증가"
      >
        <Plus size={12} />
      </button>
      {onMax && (
        <button
          type="button"
          onClick={onMax}
          className="px-2 py-1.5 bg-pink-50 text-[var(--plana-primary-dark)] hover:bg-[var(--plana-primary-dark)] hover:text-white text-[10px] font-bold border-l border-[var(--plana-border)] transition-colors"
        >
          MAX
        </button>
      )}
    </div>
  );
}

export function PlannerEditForm({ editingPlan, setEditingPlan, onSave }: PlannerEditFormProps) {
  if (!editingPlan) return null;

  const curStar = editingPlan.currentStar || 3;
  const curLevel = editingPlan.currentLevel || 1;
  const curWStar = editingPlan.currentWeaponStar || 0;
  const curWLevel = editingPlan.currentWeaponLevel || 1;

  const handleAllMaxPreset = () => {
    setEditingPlan({
      ...editingPlan,
      targetStar: 5,
      targetLevel: 90,
      targetEx: SKILL_MAX.ex,
      targetBasic: SKILL_MAX.normal,
      targetEnh: SKILL_MAX.passive,
      targetSub: SKILL_MAX.sub,
      targetEquip1: 10,
      targetEquip1Level: getEquipMaxLevel(10),
      targetEquip2: 10,
      targetEquip2Level: getEquipMaxLevel(10),
      targetEquip3: 10,
      targetEquip3Level: getEquipMaxLevel(10),
      targetWeaponStar: Math.max(3, curWStar),
      targetWeaponLevel: Math.max(getWeaponMaxLevel(Math.max(3, curWStar)), curWLevel),
    });
  };

  const handleResetToCurrent = () => {
    setEditingPlan({
      ...editingPlan,
      targetStar: curStar,
      targetLevel: curLevel,
      targetEx: editingPlan.currentEx || 1,
      targetBasic: editingPlan.currentBasic || 1,
      targetEnh: editingPlan.currentEnh || 1,
      targetSub: editingPlan.currentSub || 1,
      targetEquip1: editingPlan.currentEquip1 || 0,
      targetEquip1Level: editingPlan.currentEquip1Level || 1,
      targetEquip2: editingPlan.currentEquip2 || 0,
      targetEquip2Level: editingPlan.currentEquip2Level || 1,
      targetEquip3: editingPlan.currentEquip3 || 0,
      targetEquip3Level: editingPlan.currentEquip3Level || 1,
      targetWeaponStar: curWStar,
      targetWeaponLevel: curWLevel,
      targetAbilityHP: editingPlan.currentAbilityHP || 0,
      targetAbilityAtk: editingPlan.currentAbilityAtk || 0,
      targetAbilityHeal: editingPlan.currentAbilityHeal || 0,
    });
  };

            const modalContent = (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white/95 backdrop-blur-md w-full max-w-4xl max-h-[88vh] rounded-2xl border border-[var(--plana-border)] shadow-2xl flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[var(--plana-border)] bg-[var(--plana-bg-panel)] backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    {editingPlan.student?.portraitUrls?.[0] && (
                      <img
                        src={getImageUrl(editingPlan.student.portraitUrls[0])}
                        alt={editingPlan.student.name || ''}
                        className="w-11 h-11 rounded-xl object-cover border border-[var(--plana-border)] ring-2 ring-[var(--plana-primary-light)]/40"
                      />
                    )}
                    <div>
                      <span className="inline-block -skew-x-6 bg-[var(--plana-primary-light)]/40 text-[var(--plana-primary-dark)] border border-[var(--plana-border)] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-0.5">
                        <span className="inline-block skew-x-6 font-semibold">TARGET CONFIG</span>
                      </span>
                      <h3 className="font-[TitleV] text-lg font-bold text-slate-900 leading-tight">
                        {editingPlan.student?.name} 육성 목표 설정
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAllMaxPreset}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--plana-primary-light)]/40 hover:bg-[var(--plana-primary-dark)] text-[var(--plana-primary-dark)] hover:text-white border border-[var(--plana-border)] text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      <Zap size={13} /> 퍼펙트(MAX)
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToCurrent}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      <RotateCcw size={13} /> 초기화
                    </button>
                    <button
                      onClick={() => setEditingPlan(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-pink-50 rounded-lg transition-colors ml-1"
                      aria-label="닫기"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Modal Body: 2-Column Bento Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 1. 캐릭터 성장 */}
                    <section className="bg-slate-50/70 rounded-xl p-4 border border-[var(--plana-border)]/70 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                        <span className="w-1.5 h-3.5 rounded-full bg-[var(--plana-primary-dark)]" />
                        캐릭터 성장
                      </h4>
                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[var(--plana-border)]/60 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-slate-800">성급</div>
                          <div className="text-[11px] text-slate-400 tabular-nums">현재 {curStar}★</div>
                        </div>
                        <NumberStepper
                          value={editingPlan.targetStar || 5}
                          min={curStar}
                          max={5}
                          onChange={(v) => setEditingPlan({ ...editingPlan, targetStar: v })}
                          onMax={() => setEditingPlan({ ...editingPlan, targetStar: 5 })}
                        />
                      </div>
                        <div className="bg-white p-3 rounded-xl border border-[var(--plana-border)]/60 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-800">레벨</div>
                              <div className="text-[11px] text-slate-400 tabular-nums">현재 Lv.{curLevel}</div>
                            </div>
                            <NumberStepper
                              value={editingPlan.targetLevel}
                              min={curLevel}
                              max={90}
                              onChange={(v) => setEditingPlan({ ...editingPlan, targetLevel: v })}
                              onMax={() => setEditingPlan({ ...editingPlan, targetLevel: 90 })}
                            />
                          </div>
                          <input
                            type="range"
                            min={curLevel}
                            max={90}
                            value={editingPlan.targetLevel}
                            onChange={(e) => setEditingPlan({ ...editingPlan, targetLevel: Number(e.target.value) })}
                            className="w-full accent-[var(--plana-primary-dark)] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                    </section>

                                {/* 2. 스킬 성장 */}
                                <section className="bg-slate-50/70 rounded-xl p-4 border border-[var(--plana-border)]/70 space-y-3">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                    <span className="w-1.5 h-3.5 rounded-full bg-[var(--plana-primary-dark)]" />
                                    스킬 성장
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {[
                                      { label: 'EX 스킬', curKey: 'currentEx', tgtKey: 'targetEx', max: SKILL_MAX.ex },
                                      { label: '기본 스킬', curKey: 'currentBasic', tgtKey: 'targetBasic', max: SKILL_MAX.normal },
                                      { label: '강화 스킬', curKey: 'currentEnh', tgtKey: 'targetEnh', max: SKILL_MAX.passive },
                                      { label: '서브 스킬', curKey: 'currentSub', tgtKey: 'targetSub', max: SKILL_MAX.sub },
                                    ].map((sk) => {
                                      const cur = editingPlan[sk.curKey] || 1;
                                      const tgt = editingPlan[sk.tgtKey] || cur;
                                      return (
                    <div
                      key={sk.tgtKey}
                      className="flex flex-col gap-2 bg-white p-2.5 rounded-xl border border-[var(--plana-border)]/60 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{sk.label}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">현재 {cur}</span>
                      </div>
                      <div className="flex justify-end">
                        <NumberStepper
                          value={tgt}
                          min={cur}
                          max={sk.max}
                          onChange={(v) => setEditingPlan({ ...editingPlan, [sk.tgtKey]: v })}
                          onMax={() => setEditingPlan({ ...editingPlan, [sk.tgtKey]: Math.max(sk.max, cur) })}
                        />
                      </div>
                    </div>
                                );
                })}
                              </div>
                            </section>

                            {/* 3. 장비 티어 */}
                            <section className="bg-slate-50/70 rounded-xl p-4 border border-[var(--plana-border)]/70 space-y-2.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                <span className="w-1.5 h-3.5 rounded-full bg-amber-500" />
                                장비 티어 (T1~T10)
                              </h4>
                              {[1, 2, 3].map((slot) => {
                                const curT = editingPlan[`currentEquip${slot}`] || 0;
                                const curL = editingPlan[`currentEquip${slot}Level`] || 1;
                                const tgtT = editingPlan[`targetEquip${slot}`] || 0;
                                const tgtL = editingPlan[`targetEquip${slot}Level`] || 1;
                                const label = slot === 1 ? '슬롯 1 (공격)' : slot === 2 ? '슬롯 2 (방어)' : '슬롯 3 (보조)';

                                        return (
                                        <div key={slot} className="bg-white p-3 rounded-xl border border-[var(--plana-border)]/60 shadow-2xs space-y-2">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold text-slate-800">{label}</span>
                                              <span className="text-[11px] text-slate-400 tabular-nums">
                                                {curT === 0 ? '미착용' : `T${curT} Lv.${curL}`}
                                              </span>
                                            </div>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                      checked = { tgtT === 0
                                                    }
                          onChange={(e) =>
                                                      setEditingPlan({
                                                        ...editingPlan,
                                                  [`targetEquip${slot}`]: e.target.checked ? 0 : Math.max(1, curT),
                                                  [`targetEquip${slot}Level`]: e.target.checked ? 1 : Math.max(1, curL),
                            })
                          }
                                                  className="w-3.5 h-3.5 accent-[var(--plana-primary-dark)] rounded"
                        />
                                                  <span className="text-[11px] text-slate-500 font-semibold">미착용</span>
                                                </label>
                                              </div>
                                                  <div className={`flex flex-wrap items-center justify-between gap-2 ${tgtT === 0 ? 'opacity-40 pointer-events-none' : ''}`}>
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-[11px] font-semibold text-slate-500">T</span>
                                                      <NumberStepper
                                                          value = { tgtT || 1
                                                        }
                          min={Math.max(1, curT)}
                                                        max={10}
                                                        onChange={(val) =>
                                                          setEditingPlan({
                                                            ...editingPlan,
                                                        [`targetEquip${slot}`]: val,
                                                      [`targetEquip${slot}Level`]: Math.max(getEquipMaxLevel(val), curL),
                            })
                          }
                                                      onMax={() =>
                                                        setEditingPlan({
                                                          ...editingPlan,
                                                      [`targetEquip${slot}`]: 10,
                                                      [`targetEquip${slot}Level`]: getEquipMaxLevel(10),
                            })
                          }
                        />
                                                    </div>
                                                      <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] font-semibold text-slate-500">Lv</span>
                                                        <NumberStepper
                                                          value={tgtL}
                                                          min={curT === tgtT ? Math.max(1, curL) : 1}
                                                          max={90}
                                                          onChange={(val) => setEditingPlan({ ...editingPlan, [`targetEquip${slot}Level`]: val })}
                                                        />
                                                      </div>
                                                    </div>
                                                </div>
                                                );
              })}
                                            </section>

                                                {/* 4. 고유무기 + 능력 개방 */}
                                                <div className="space-y-4">
                                                  <section className="bg-slate-50/70 rounded-xl p-4 border border-[var(--plana-border)]/70 space-y-2.5">
                                                    <div className="flex items-center justify-between">
                                                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                                        <span className="w-1.5 h-3.5 rounded-full bg-purple-500" />
                                                        고유무기
                                                      </h4>
                                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                          type="checkbox"
                                                          checked={editingPlan.targetWeaponStar === 0}
                                                          onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setEditingPlan({
                                                              ...editingPlan,
                                                              targetWeaponStar: checked ? 0 : Math.max(1, curWStar || 1),
                                                              targetWeaponLevel: checked ? 1 : Math.max(1, curWLevel),
                                                            });
                                                          }}
                                                          className="w-3.5 h-3.5 accent-[var(--plana-primary-dark)] rounded"
                                                        />
                                                        <span className="text-[11px] text-slate-500 font-semibold">미착용</span>
                                                      </label>
                                                    </div>
                                                    {(editingPlan.targetStar || 5) < 5 && editingPlan.targetWeaponStar > 0 && (
                                                      <div className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                                                        고유무기 해금에는 5성이 필요합니다.
                                                      </div>
                                                    )}
                                                    <div className={`grid grid-cols-1 gap-2 ${editingPlan.targetWeaponStar === 0 ? 'opacity-40 pointer-events-none' : ''}`}>
                                                      <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-[var(--plana-border)]/60 shadow-2xs">
                                                        <div>
                                                          <span className="text-xs font-bold text-slate-800">성급</span>
                                                          <span className="text-[11px] text-slate-400 ml-1.5 tabular-nums">현재 {curWStar}★</span>
                                                        </div>
                                                      <NumberStepper
                                                        value={editingPlan.targetWeaponStar || 1}
                                                        min={Math.max(1, curWStar || 1)}
                                                        max={4}
                                                        onChange={(v) => {
                                                          const maxLvl = getWeaponMaxLevel(v);
                                                          setEditingPlan({
                                                            ...editingPlan,
                                                            targetWeaponStar: v,
                                                            targetWeaponLevel: Math.max(Math.min(editingPlan.targetWeaponLevel || 1, maxLvl), curWLevel),
                                                            targetStar: v >= 1 ? 5 : editingPlan.targetStar,
                                                          });
                                                        }}
                                                        onMax={() => {
                                                          const maxLvl = getWeaponMaxLevel(4);
                                                          setEditingPlan({
                                                            ...editingPlan,
                                                            targetWeaponStar: 4,
                                                            targetWeaponLevel: Math.max(Math.min(editingPlan.targetWeaponLevel || 1, maxLvl), curWLevel),
                                                            targetStar: 5,
                                                          });
                                                        }}
                                                      />
                                                    </div>
                                                    <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-[var(--plana-border)]/60 shadow-2xs">
                                                      <div>
                                                        <span className="text-xs font-bold text-slate-800">레벨</span>
                                                        <span className="text-[11px] text-slate-400 ml-1.5 tabular-nums">
                                                          {curWStar ? `현재 ${curWLevel}` : '미해금'}
                                                        </span>
                                                      </div>
                                                      <NumberStepper
                                                        value={editingPlan.targetWeaponLevel || 1}
                                                        min={editingPlan.targetWeaponStar === curWStar ? curWLevel : 1}
                                                        max={getWeaponMaxLevel(editingPlan.targetWeaponStar || 1)}
                                                        onChange={(v) => setEditingPlan({ ...editingPlan, targetWeaponLevel: v })}
                                                        onMax={() => {
                                                          const maxLvl = getWeaponMaxLevel(editingPlan.targetWeaponStar || 1);
                                                          setEditingPlan({ ...editingPlan, targetWeaponLevel: Math.max(maxLvl, curWLevel) });
                                                        }}
                                                      />
                                                    </div>
                                                </div>
                                        </section>

                                          <section className="bg-slate-50/70 rounded-xl p-4 border border-[var(--plana-border)]/70 space-y-2.5">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                              <span className="w-1.5 h-3.5 rounded-full bg-[var(--plana-primary)]" />
                                              능력 개방 (WB, 0~25)
                                            </h4>
                                            <div className="space-y-2">
                                              {[
                                                { label: 'HP (체육)', curKey: 'currentAbilityHP', tgtKey: 'targetAbilityHP' },
                                                { label: '공격력 (사격)', curKey: 'currentAbilityAtk', tgtKey: 'targetAbilityAtk' },
                                                { label: '치유력 (위생)', curKey: 'currentAbilityHeal', tgtKey: 'targetAbilityHeal' },
                                              ].map((ab) => {
                                                const cur = editingPlan[ab.curKey] || 0;
                                                const tgt = editingPlan[ab.tgtKey] ?? cur;
                                                return (
                                                  <div
                                                    key={ab.tgtKey}
                                                    className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[var(--plana-border)]/60 shadow-2xs"
                                                  >
                                                    <div>
                                                      <span className="text-xs font-bold text-slate-800">{ab.label}</span>
                                                      <span className="text-[11px] text-slate-400 ml-1.5 tabular-nums">현재 {cur}</span>
                                                    </div>
                                                    <NumberStepper
                                                      value={tgt}
                                                      min={cur}
                                                      max={25}
                                                      onChange={(v) => setEditingPlan({ ...editingPlan, [ab.tgtKey]: v })}
                                                    />
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </section>
                                        </div>
                                      </div>
        </div>

                              {/* Modal Footer */}
                              <div className="px-5 py-3.5 border-t border-[var(--plana-border)] bg-[var(--plana-bg-panel)] backdrop-blur-md flex justify-end gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingPlan(null)}
                                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200/70 transition-colors"
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onSave(editingPlan)}
                                  className="flex items-center gap-1.5 px-6 py-2 bg-[var(--plana-primary-dark)] hover:bg-pink-500 text-white rounded-xl font-bold text-sm shadow-sm shadow-pink-500/20 transition-all active:scale-[0.98]"
                                >
                                  <Check size={16} /> 저장하기
                                </button>
                              </div>
                          </div>
                      </div>
                      );

                      return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
