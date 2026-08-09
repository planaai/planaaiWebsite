import React from 'react';
import { X, Check } from 'lucide-react';
import { getEquipMaxLevel, getWeaponMaxLevel, SKILL_MAX } from '@/lib/equipmentUtils';

interface PlannerEditFormProps {
  editingPlan: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  setEditingPlan: (plan: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => void;
  onSave: (plan: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => void;
}

export function PlannerEditForm({ editingPlan, setEditingPlan, onSave }: PlannerEditFormProps) {
  if (!editingPlan) return null;

  const disabledInputClass = "w-full sm:w-16 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-center text-slate-400 cursor-not-allowed";
  const activeInputClass = "w-full sm:w-16 bg-white border-2 border-pink-200 focus:border-[var(--plana-primary)] focus:outline-none rounded-lg px-2 py-1.5 text-center text-slate-800 transition-colors";

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full overflow-y-auto custom-scrollbar flex flex-col">
      <div className="flex justify-between items-center mb-6 sticky top-0 bg-white/90 backdrop-blur-sm p-3 rounded-xl z-10 shadow-sm border border-slate-100 shrink-0">
        <h3 className="text-lg font-bold text-[var(--plana-primary)]">{editingPlan.student?.name} 목표 수정</h3>
        <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-[var(--plana-primary)] transition-colors"><X size={20}/></button>
      </div>
      
      <div className="space-y-6 flex-1 pb-4">
        {/* 캐릭터 성장 */}
        <div className="bg-slate-50 shadow-sm -skew-x-[5deg] rounded-xl border border-slate-100">
            <div className="skew-x-[5deg] p-6">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>캐릭터 성장
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">현재 성급</label>
                      <input type="number" min="1" max="5" value={editingPlan.currentStar || 3} disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--plana-primary)] mb-1.5">목표 성급</label>
                      <input type="number" min={editingPlan.currentStar || 3} max="5" value={editingPlan.targetStar || 5} onChange={e => { const v = Math.max((parseInt(e.target.value) || 0), editingPlan.currentStar || 3); setEditingPlan({...editingPlan, targetStar: v, targetWeaponStar: v < 5 ? 0 : editingPlan.targetWeaponStar, targetWeaponLevel: v < 5 ? 1 : editingPlan.targetWeaponLevel}); }} className="w-full bg-white border-2 border-pink-200 focus:border-[var(--plana-primary)] focus:outline-none rounded-lg px-3 py-2 text-slate-800 transition-colors" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">현재 레벨</label>
                      <input type="number" min="1" max="90" value={editingPlan.currentLevel} disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--plana-primary)] mb-1.5">목표 레벨</label>
                      <input type="number" min={editingPlan.currentLevel} max="90" value={editingPlan.targetLevel} onChange={e => setEditingPlan({...editingPlan, targetLevel: Math.max((parseInt(e.target.value) || 0), editingPlan.currentLevel)})} className="w-full bg-white border-2 border-pink-200 focus:border-[var(--plana-primary)] focus:outline-none rounded-lg px-3 py-2 text-slate-800 transition-colors" />
                    </div>
                </div>
            </div>
        </div>
        
        {/* 스킬 성장 */}
        <div className="bg-white shadow-sm -skew-x-[5deg] rounded-xl border border-slate-100">
            <div className="skew-x-[5deg] p-6">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>스킬 성장
                </h4>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">EX 스킬 <span className="text-[10px] opacity-70 font-normal">(1~5)</span></label>
                        <div className="flex gap-1 items-center"><input type="number" min="1" max="5" value={editingPlan.currentEx} disabled className={disabledInputClass} /><span className="text-slate-300 font-bold mx-1">➔</span><input type="number" min={editingPlan.currentEx} max="5" value={editingPlan.targetEx} onChange={e => setEditingPlan({...editingPlan, targetEx: Math.max((parseInt(e.target.value) || 0), editingPlan.currentEx)})} className={activeInputClass} /><button type="button" onClick={() => setEditingPlan({...editingPlan, targetEx: Math.max(SKILL_MAX.ex, editingPlan.currentEx)})} className="w-7 h-7 flex-shrink-0 bg-[var(--plana-primary-light)] text-[var(--plana-primary)] text-xs font-bold rounded hover:bg-[var(--plana-primary)] hover:text-white transition-colors">M</button></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">기본 스킬 <span className="text-[10px] opacity-70 font-normal">(1~10)</span></label>
                        <div className="flex gap-1 items-center"><input type="number" min="1" max="10" value={editingPlan.currentBasic} disabled className={disabledInputClass} /><span className="text-slate-300 font-bold mx-1">➔</span><input type="number" min={editingPlan.currentBasic} max="10" value={editingPlan.targetBasic} onChange={e => setEditingPlan({...editingPlan, targetBasic: Math.max((parseInt(e.target.value) || 0), editingPlan.currentBasic)})} className={activeInputClass} /><button type="button" onClick={() => setEditingPlan({...editingPlan, targetBasic: Math.max(SKILL_MAX.normal, editingPlan.currentBasic)})} className="w-7 h-7 flex-shrink-0 bg-[var(--plana-primary-light)] text-[var(--plana-primary)] text-xs font-bold rounded hover:bg-[var(--plana-primary)] hover:text-white transition-colors">M</button></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">강화 스킬 <span className="text-[10px] opacity-70 font-normal">(1~10)</span></label>
                        <div className="flex gap-1 items-center"><input type="number" min="1" max="10" value={editingPlan.currentEnh} disabled className={disabledInputClass} /><span className="text-slate-300 font-bold mx-1">➔</span><input type="number" min={editingPlan.currentEnh} max="10" value={editingPlan.targetEnh} onChange={e => setEditingPlan({...editingPlan, targetEnh: Math.max((parseInt(e.target.value) || 0), editingPlan.currentEnh)})} className={activeInputClass} /><button type="button" onClick={() => setEditingPlan({...editingPlan, targetEnh: Math.max(SKILL_MAX.passive, editingPlan.currentEnh)})} className="w-7 h-7 flex-shrink-0 bg-[var(--plana-primary-light)] text-[var(--plana-primary)] text-xs font-bold rounded hover:bg-[var(--plana-primary)] hover:text-white transition-colors">M</button></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">서브 스킬 <span className="text-[10px] opacity-70 font-normal">(1~10)</span></label>
                        <div className="flex gap-1 items-center"><input type="number" min="1" max="10" value={editingPlan.currentSub} disabled className={disabledInputClass} /><span className="text-slate-300 font-bold mx-1">➔</span><input type="number" min={editingPlan.currentSub} max="10" value={editingPlan.targetSub} onChange={e => setEditingPlan({...editingPlan, targetSub: Math.max((parseInt(e.target.value) || 0), editingPlan.currentSub)})} className={activeInputClass} /><button type="button" onClick={() => setEditingPlan({...editingPlan, targetSub: Math.max(SKILL_MAX.sub, editingPlan.currentSub)})} className="w-7 h-7 flex-shrink-0 bg-[var(--plana-primary-light)] text-[var(--plana-primary)] text-xs font-bold rounded hover:bg-[var(--plana-primary)] hover:text-white transition-colors">M</button></div>
                    </div>
                </div>
            </div>
        </div>

        {/* 장비 */}
        <div className="bg-slate-50 shadow-sm -skew-x-[5deg] rounded-xl border border-slate-100">
            <div className="skew-x-[5deg] p-6">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>장비 티어 <span className="text-[10px] font-normal text-slate-500">(1~10)</span>
                </h4>
                <div className="grid grid-cols-1 gap-6">
                    {[1, 2, 3].map((slot) => {
                        const curT = editingPlan[`currentEquip${slot}`] || 0;
                        const curL = editingPlan[`currentEquip${slot}Level`] || 1;
                        const tgtT = editingPlan[`targetEquip${slot}`] || 0;
                        const tgtL = editingPlan[`targetEquip${slot}Level`] || 1;
                        const label = slot === 1 ? '슬롯1 (모자/장갑...)' : slot === 2 ? '슬롯2 (헤어핀...)' : '슬롯3 (시계/부적...)';
                        
                        return (
                        <div key={slot} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-500">{label}</label>
                                <label className="flex items-center gap-2 cursor-pointer w-max">
                                    <input type="checkbox" checked={tgtT === 0} onChange={(e) => setEditingPlan({...editingPlan, [`targetEquip${slot}`]: e.target.checked ? 0 : Math.max(1, curT), [`targetEquip${slot}Level`]: e.target.checked ? 1 : Math.max(1, curL)})} className="w-3.5 h-3.5 text-[var(--plana-primary)] rounded" />
                                    <span className="text-[10px] text-slate-500 font-bold">미착용 목표</span>
                                </label>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                {/* 현재 */}
                                <div className={`flex gap-1 ${curT === 0 ? 'opacity-50' : ''}`}>
                                    <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                                        <span className="text-[10px] font-bold px-1.5 text-slate-400">T</span>
                                        <input type="number" value={curT === 0 ? '' : curT} disabled className="w-8 bg-transparent px-1 py-1.5 text-xs text-center text-slate-400 focus:outline-none" />
                                    </div>
                                    <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                                        <span className="text-[10px] font-bold px-1.5 text-slate-400">Lv</span>
                                        <input type="number" value={curT === 0 ? '' : curL} disabled className="w-10 bg-transparent px-1 py-1.5 text-xs text-center text-slate-400 focus:outline-none" />
                                    </div>
                                </div>
                                <span className="text-slate-300 font-bold hidden sm:block">➔</span>
                                {/* 목표 */}
                                <div className={`flex gap-1 flex-1 ${tgtT === 0 ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <div className="flex-1 flex items-stretch bg-white border border-[var(--plana-border)] rounded-lg overflow-hidden focus-within:border-[var(--plana-accent)]">
                                        <span className="text-[10px] text-[var(--plana-primary-dark)] font-bold px-1.5 bg-[var(--plana-primary-light)]/30 flex items-center">T</span>
                                        <input type="number" min={Math.max(1, curT)} max={10} value={tgtT === 0 ? '' : tgtT} onChange={e => {
                                            const val = Math.max(parseInt(e.target.value) || 1, curT);
                                            setEditingPlan({...editingPlan, [`targetEquip${slot}`]: val, [`targetEquip${slot}Level`]: Math.max(getEquipMaxLevel(val), curL)});
                                        }} className="w-full bg-transparent px-1 py-1.5 text-xs text-center focus:outline-none min-w-0" />
                                        <button type="button" onClick={() => setEditingPlan({...editingPlan, [`targetEquip${slot}`]: 10, [`targetEquip${slot}Level`]: getEquipMaxLevel(10)})} className="px-2 bg-[var(--plana-primary-light)] text-[var(--plana-primary)] hover:bg-[var(--plana-primary)] hover:text-white text-[10px] font-bold transition-colors flex-shrink-0 flex items-center justify-center">M</button>
                                    </div>
                                    <div className="flex-1 flex items-stretch bg-white border border-[var(--plana-border)] rounded-lg overflow-hidden focus-within:border-[var(--plana-accent)]">
                                        <span className="text-[10px] text-[var(--plana-primary-dark)] font-bold px-1.5 bg-[var(--plana-primary-light)]/30 flex items-center">Lv</span>
                                        <input type="number" min={curT === tgtT ? Math.max(1, curL) : 1} max={90} value={tgtT === 0 ? '' : tgtL} onChange={e => {
                                            const val = Math.max(parseInt(e.target.value) || 1, curT === tgtT ? curL : 1);
                                            setEditingPlan({...editingPlan, [`targetEquip${slot}Level`]: val});
                                        }} className="w-full bg-transparent px-1 py-1.5 text-xs text-center focus:outline-none min-w-0" />
                                        <button type="button" onClick={() => setEditingPlan({...editingPlan, [`targetEquip${slot}Level`]: Math.max(getEquipMaxLevel(tgtT), curL)})} className="px-2 bg-[var(--plana-primary-light)] text-[var(--plana-primary)] hover:bg-[var(--plana-primary)] hover:text-white text-[10px] font-bold transition-colors flex-shrink-0 flex items-center justify-center">M</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* 고유무기 */}
        <div className="bg-white shadow-sm -skew-x-[5deg] rounded-xl border border-slate-100">
            <div className="skew-x-[5deg] p-6">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>고유무기
                </h4>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer w-max">
                            <input type="checkbox" checked={editingPlan.targetWeaponStar === 0} onChange={(e) => {
                                const checked = e.target.checked;
                                setEditingPlan({
                                    ...editingPlan, 
                                    targetWeaponStar: checked ? 0 : Math.max(1, editingPlan.currentWeaponStar || 1),
                                    targetWeaponLevel: checked ? 1 : Math.max(1, editingPlan.currentWeaponLevel || 1)
                                });
                            }} className="w-3.5 h-3.5 text-[var(--plana-primary)] rounded" />
                            <span className="text-[10px] text-slate-500 font-bold">미착용 목표</span>
                        </label>
                    </div>
                    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 transition-opacity ${editingPlan.targetWeaponStar === 0 ? 'opacity-40 pointer-events-none' : ''}`}>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">성급 <span className="font-normal opacity-70">(0~4)</span></label>
                            <div className="flex gap-1 items-center">
                                <input type="number" value={editingPlan.currentWeaponStar || 0} disabled className={disabledInputClass.replace('sm:w-16', 'w-12')} />
                                <span className="text-slate-300 font-bold mx-1">➔</span>
                                <div className="flex-1 flex items-stretch bg-white border-2 border-pink-200 focus-within:border-[var(--plana-primary)] rounded-lg overflow-hidden transition-colors">
                                    <input type="number" min={Math.max(1, editingPlan.currentWeaponStar || 1)} max="4" value={editingPlan.targetWeaponStar === 0 ? '' : (editingPlan.targetWeaponStar || '')} onChange={e => { const v = Math.max((parseInt(e.target.value) || 0), editingPlan.currentWeaponStar || 0); const maxLvl = getWeaponMaxLevel(v); setEditingPlan({...editingPlan, targetWeaponStar: v, targetWeaponLevel: Math.max(Math.min(editingPlan.targetWeaponLevel || 1, maxLvl), editingPlan.currentWeaponLevel || 1), targetStar: v >= 1 ? 5 : editingPlan.targetStar}); }} className="w-full bg-transparent px-2 py-1.5 text-center text-slate-800 focus:outline-none min-w-0" />
                                    <button type="button" onClick={() => { const v = 4; const maxLvl = getWeaponMaxLevel(v); setEditingPlan({...editingPlan, targetWeaponStar: v, targetWeaponLevel: Math.max(Math.min(editingPlan.targetWeaponLevel || 1, maxLvl), editingPlan.currentWeaponLevel || 1), targetStar: 5}); }} className="px-2 bg-[var(--plana-primary-light)] text-[var(--plana-primary)] hover:bg-[var(--plana-primary)] hover:text-white text-xs font-bold transition-colors flex-shrink-0 flex items-center justify-center">M</button>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">레벨</label>
                            <div className="flex gap-1 items-center">
                                <input type="number" value={editingPlan.currentWeaponStar ? (editingPlan.currentWeaponLevel || 1) : ''} disabled className={disabledInputClass.replace('sm:w-16', 'w-12')} />
                                <span className="text-slate-300 font-bold mx-1">➔</span>
                                <div className="flex-1 flex items-stretch bg-white border-2 border-pink-200 focus-within:border-[var(--plana-primary)] rounded-lg overflow-hidden transition-colors">
                                    <input type="number" min={editingPlan.targetWeaponStar === (editingPlan.currentWeaponStar || 0) ? (editingPlan.currentWeaponLevel || 1) : 1} max={getWeaponMaxLevel(editingPlan.targetWeaponStar || 1)} value={editingPlan.targetWeaponStar === 0 ? '' : (editingPlan.targetWeaponLevel || '')} onChange={e => { const maxLvl = getWeaponMaxLevel(editingPlan.targetWeaponStar || 1); setEditingPlan({...editingPlan, targetWeaponLevel: Math.max(Math.min((parseInt(e.target.value) || 0), maxLvl), editingPlan.targetWeaponStar === (editingPlan.currentWeaponStar || 0) ? (editingPlan.currentWeaponLevel || 1) : 1)}); }} className="w-full bg-transparent px-2 py-1.5 text-center text-slate-800 focus:outline-none min-w-0" />
                                    <button type="button" onClick={() => { const maxLvl = getWeaponMaxLevel(editingPlan.targetWeaponStar || 1); setEditingPlan({...editingPlan, targetWeaponLevel: Math.max(maxLvl, editingPlan.currentWeaponLevel || 1)}); }} className="px-2 bg-[var(--plana-primary-light)] text-[var(--plana-primary)] hover:bg-[var(--plana-primary)] hover:text-white text-xs font-bold transition-colors flex-shrink-0 flex items-center justify-center">M</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* 능력 개방 (WB) */}
        <div className="bg-slate-50 shadow-sm -skew-x-[5deg] rounded-xl border border-slate-100">
            <div className="skew-x-[5deg] p-6">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>능력 개방 잠재력 <span className="font-normal text-slate-500 text-[10px]">(0~25)</span>
                </h4>
                <div className="space-y-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">HP (체육)</label>
                          <input type="number" min="0" max="25" value={editingPlan.currentAbilityHP} disabled className={disabledInputClass.replace('sm:w-16', 'w-full')} />
                        </div>
                        <span className="text-slate-300 font-bold mt-5">➔</span>
                        <div>
                          <label className="block text-xs font-bold text-[var(--plana-primary)] mb-1.5">목표</label>
                          <input type="number" min={editingPlan.currentAbilityHP} max="25" value={editingPlan.targetAbilityHP} onChange={e => setEditingPlan({...editingPlan, targetAbilityHP: Math.max((parseInt(e.target.value) || 0), editingPlan.currentAbilityHP)})} className={activeInputClass.replace('sm:w-16', 'w-full')} />
                        </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">공격력 (사격)</label>
                          <input type="number" min="0" max="25" value={editingPlan.currentAbilityAtk} disabled className={disabledInputClass.replace('sm:w-16', 'w-full')} />
                        </div>
                        <span className="text-slate-300 font-bold mt-5">➔</span>
                        <div>
                          <label className="block text-xs font-bold text-[var(--plana-primary)] mb-1.5">목표</label>
                          <input type="number" min={editingPlan.currentAbilityAtk} max="25" value={editingPlan.targetAbilityAtk} onChange={e => setEditingPlan({...editingPlan, targetAbilityAtk: Math.max((parseInt(e.target.value) || 0), editingPlan.currentAbilityAtk)})} className={activeInputClass.replace('sm:w-16', 'w-full')} />
                        </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">치유력 (위생)</label>
                          <input type="number" min="0" max="25" value={editingPlan.currentAbilityHeal} disabled className={disabledInputClass.replace('sm:w-16', 'w-full')} />
                        </div>
                        <span className="text-slate-300 font-bold mt-5">➔</span>
                        <div>
                          <label className="block text-xs font-bold text-[var(--plana-primary)] mb-1.5">목표</label>
                          <input type="number" min={editingPlan.currentAbilityHeal} max="25" value={editingPlan.targetAbilityHeal} onChange={e => setEditingPlan({...editingPlan, targetAbilityHeal: Math.max((parseInt(e.target.value) || 0), editingPlan.currentAbilityHeal)})} className={activeInputClass.replace('sm:w-16', 'w-full')} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end shrink-0 bg-white rounded-b-xl sticky bottom-0">
        <button 
          onClick={() => onSave(editingPlan)} 
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 bg-[var(--plana-primary)] hover:bg-[#d85e82] text-white rounded-xl font-bold transition-all shadow-md shadow-pink-500/20 hover:shadow-pink-500/40 hover:-translate-y-0.5"
        >
          <Check size={20} /> 저장하기
        </button>
      </div>
    </div>
  );
}
