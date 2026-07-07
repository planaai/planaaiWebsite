import React from 'react';
import { X, Check } from 'lucide-react';

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
                        <div className="flex gap-2 items-center"><input type="number" min="1" max="5" value={editingPlan.currentEx} disabled className={disabledInputClass} /><span className="text-slate-300 font-bold">➔</span><input type="number" min={editingPlan.currentEx} max="5" value={editingPlan.targetEx} onChange={e => setEditingPlan({...editingPlan, targetEx: Math.max((parseInt(e.target.value) || 0), editingPlan.currentEx)})} className={activeInputClass} /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">기본 스킬 <span className="text-[10px] opacity-70 font-normal">(1~10)</span></label>
                        <div className="flex gap-2 items-center"><input type="number" min="1" max="10" value={editingPlan.currentBasic} disabled className={disabledInputClass} /><span className="text-slate-300 font-bold">➔</span><input type="number" min={editingPlan.currentBasic} max="10" value={editingPlan.targetBasic} onChange={e => setEditingPlan({...editingPlan, targetBasic: Math.max((parseInt(e.target.value) || 0), editingPlan.currentBasic)})} className={activeInputClass} /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">강화 스킬 <span className="text-[10px] opacity-70 font-normal">(1~10)</span></label>
                        <div className="flex gap-2 items-center"><input type="number" min="1" max="10" value={editingPlan.currentEnh} disabled className={disabledInputClass} /><span className="text-slate-300 font-bold">➔</span><input type="number" min={editingPlan.currentEnh} max="10" value={editingPlan.targetEnh} onChange={e => setEditingPlan({...editingPlan, targetEnh: Math.max((parseInt(e.target.value) || 0), editingPlan.currentEnh)})} className={activeInputClass} /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">서브 스킬 <span className="text-[10px] opacity-70 font-normal">(1~10)</span></label>
                        <div className="flex gap-2 items-center"><input type="number" min="1" max="10" value={editingPlan.currentSub} disabled className={disabledInputClass} /><span className="text-slate-300 font-bold">➔</span><input type="number" min={editingPlan.currentSub} max="10" value={editingPlan.targetSub} onChange={e => setEditingPlan({...editingPlan, targetSub: Math.max((parseInt(e.target.value) || 0), editingPlan.currentSub)})} className={activeInputClass} /></div>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">슬롯1 (모자/장갑...)</label>
                        <div className="flex gap-2 items-center"><input type="number" min="1" max="10" value={editingPlan.currentEquip1} disabled className={disabledInputClass.replace('sm:w-16', 'flex-1')} /><span className="text-slate-300 font-bold">➔</span><input type="number" min={editingPlan.currentEquip1} max="10" value={editingPlan.targetEquip1} onChange={e => setEditingPlan({...editingPlan, targetEquip1: Math.max((parseInt(e.target.value) || 0), editingPlan.currentEquip1)})} className={activeInputClass.replace('sm:w-16', 'flex-1')} /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">슬롯2 (헤어핀...)</label>
                        <div className="flex gap-2 items-center"><input type="number" min="1" max="10" value={editingPlan.currentEquip2} disabled className={disabledInputClass.replace('sm:w-16', 'flex-1')} /><span className="text-slate-300 font-bold">➔</span><input type="number" min={editingPlan.currentEquip2} max="10" value={editingPlan.targetEquip2} onChange={e => setEditingPlan({...editingPlan, targetEquip2: Math.max((parseInt(e.target.value) || 0), editingPlan.currentEquip2)})} className={activeInputClass.replace('sm:w-16', 'flex-1')} /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">슬롯3 (시계/부적...)</label>
                        <div className="flex gap-2 items-center"><input type="number" min="1" max="10" value={editingPlan.currentEquip3} disabled className={disabledInputClass.replace('sm:w-16', 'flex-1')} /><span className="text-slate-300 font-bold">➔</span><input type="number" min={editingPlan.currentEquip3} max="10" value={editingPlan.targetEquip3} onChange={e => setEditingPlan({...editingPlan, targetEquip3: Math.max((parseInt(e.target.value) || 0), editingPlan.currentEquip3)})} className={activeInputClass.replace('sm:w-16', 'flex-1')} /></div>
                    </div>
                </div>
            </div>
        </div>

        {/* 고유무기 */}
        <div className="bg-white shadow-sm -skew-x-[5deg] rounded-xl border border-slate-100">
            <div className="skew-x-[5deg] p-6">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>고유무기
                </h4>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">성급 <span className="font-normal opacity-70">(0~4)</span></label>
                        <div className="flex gap-2 items-center"><input type="number" min="0" max="4" value={editingPlan.currentWeaponStar} disabled className={disabledInputClass.replace('sm:w-16', 'flex-1')} /><span className="text-slate-300 font-bold">➔</span><input type="number" min={editingPlan.currentWeaponStar} max="4" value={editingPlan.targetWeaponStar} onChange={e => { const v = Math.max((parseInt(e.target.value) || 0), editingPlan.currentWeaponStar); const maxLvl = v ? v * 10 + 20 : 1; setEditingPlan({...editingPlan, targetWeaponStar: v, targetWeaponLevel: Math.min(editingPlan.targetWeaponLevel, maxLvl), targetStar: v >= 1 ? 5 : editingPlan.targetStar}); }} className={activeInputClass.replace('sm:w-16', 'flex-1')} /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">레벨</label>
                        <div className="flex gap-2 items-center"><input type="number" min="1" max={editingPlan.currentWeaponStar ? editingPlan.currentWeaponStar * 10 + 20 : 1} value={editingPlan.currentWeaponLevel} disabled className={disabledInputClass.replace('sm:w-16', 'flex-1')} /><span className="text-slate-300 font-bold">➔</span><input type="number" min={editingPlan.currentWeaponLevel} max={editingPlan.targetWeaponStar ? editingPlan.targetWeaponStar * 10 + 20 : 1} value={editingPlan.targetWeaponLevel} onChange={e => { const maxLvl = editingPlan.targetWeaponStar ? editingPlan.targetWeaponStar * 10 + 20 : 1; setEditingPlan({...editingPlan, targetWeaponLevel: Math.max(Math.min((parseInt(e.target.value) || 0), maxLvl), editingPlan.currentWeaponLevel)}); }} className={activeInputClass.replace('sm:w-16', 'flex-1')} /></div>
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
