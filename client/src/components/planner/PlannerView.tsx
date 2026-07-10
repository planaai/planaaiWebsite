'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import type { StudentMaster, SchemaConfig } from '@/types';
import { BookOpen, ShoppingCart, Plus } from 'lucide-react';

import { useArchiveStore } from '@/store/archiveStore';
import { usePlannerStore } from '@/store/plannerStore';

import { StudentSelectModal } from './StudentSelectModal';
import { PlannerPlanCard } from './PlannerPlanCard';
import { PlannerEditForm } from './PlannerEditForm';
import { PlannerCalcResult } from './PlannerCalcResult';

interface PlannerViewProps {
  masterData: StudentMaster[];
  schema: SchemaConfig | null;
}

export function PlannerView({ masterData, schema }: PlannerViewProps) {
  const { records } = useArchiveStore();
  const archiveData = Object.values(records);
  
  const { plans, addPlan, updatePlan, deletePlan } = usePlannerStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [combinedResult, setCombinedResult] = useState<any>(null);

  const handleCreatePlan = (studentId: number, archive: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    addPlan(studentId, archive);
  };

  const handleDeletePlan = (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    deletePlan(id);
    if (editingPlan?.id === id) setEditingPlan(null);
    if (calcResult?.plan?.id === id) setCalcResult(null);
  };

  const handleSavePlan = (plan: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    updatePlan(plan.id, plan);
    setEditingPlan(null);
  };

  const handleCalculate = async (plan: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    try {
      const student = masterData.find(m => m.id === plan.studentId);
      const res = await api.post(`/planner/calculate/dynamic`, { 
        plan: { 
          ...plan, 
          weaponType: student?.weaponType,
          equip1Type: student?.equipmentSlot1,
          equip2Type: student?.equipmentSlot2,
          equip3Type: student?.equipmentSlot3
        } 
      });
      setCalcResult({ plan: { ...plan, student }, required: enrichRequirements(res.data.required, student) });
      setCombinedResult(null);
      setEditingPlan(null);
    } catch (e) {
      alert('계산 실패');
    }
  };

  const handleCalculateCombined = async () => {
    setCombinedResult(null);
    setCalcResult(null);
    setEditingPlan(null);
    try {
      const total = {
        credits: 0,
        expReports: {} as Record<string, any>,
        blueprints: {} as Record<string, any>,
        elephs: 0,
        weaponExp: 0,
        weaponItems: {} as Record<string, any>,
        ooparts: {} as Record<string, any>,
        wbs: {} as Record<string, any>,
        bds: {} as Record<string, any>,
        techNotes: {} as Record<string, any>,
        secret: 0
      };
      
      const mergeRecord = (target: Record<string, any>, source: Record<string, any> = {}) => {
        for (const [key, item] of Object.entries(source)) {
          if (!target[key]) target[key] = { ...item };
          else target[key].amount += item.amount;
        }
      };

      for (const p of plans) {
        const student = masterData.find(m => m.id === p.studentId);
        const res = await api.post(`/planner/calculate/dynamic`, { 
          plan: { 
            ...p, 
            weaponType: student?.weaponType,
            equip1Type: student?.equipmentSlot1,
            equip2Type: student?.equipmentSlot2,
            equip3Type: student?.equipmentSlot3
          } 
        });
        const req = enrichRequirements(res.data.required, student);

        total.credits += req.credits;
        mergeRecord(total.expReports, req.expReports);
        mergeRecord(total.blueprints, req.blueprints);
        total.elephs += req.elephs;
        total.weaponExp += req.weaponExp;
        mergeRecord(total.weaponItems, req.weaponItems);
        total.secret += req.secret;
        mergeRecord(total.ooparts, req.ooparts);
        mergeRecord(total.wbs, req.wbs);
        mergeRecord(total.bds, req.bds);
        mergeRecord(total.techNotes, req.techNotes);
      }
      setCombinedResult(total);
    } catch (e) {
      alert('통합 계산 실패');
    }
  };

  const enrichRequirements = (req: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, student: StudentMaster | undefined) => {
    const enriched = {
      credits: req.credits,
      expReports: {} as Record<string, any>,
      blueprints: {} as Record<string, any>,
      elephs: req.elephs,
      weaponExp: req.weaponExp,
      weaponItems: {} as Record<string, any>,
      ooparts: {} as Record<string, any>,
      wbs: {} as Record<string, any>,
      bds: {} as Record<string, any>,
      techNotes: {} as Record<string, any>,
      secret: req.secret || 0
    };

    const getTierIdx = (name: string) => {
      if (name.includes('최상급') || name.startsWith('4')) return 3;
      if (name.includes('상급') || name.startsWith('3')) return 2;
      if (name.includes('일반') || name.startsWith('2')) return 1;
      return 0; // 기초, 1
    };

    // expReports
    for (const [key, amount] of Object.entries(req.expReports || {})) {
      if ((amount as number) > 0) {
        let iconUrl = '';
        if (schema?.resourceIcons?.ExpReports) {
          const tierIdx = ['초급 활동 보고서', '일반 활동 보고서', '상급 활동 보고서', '최상급 활동 보고서'].indexOf(key);
          if (tierIdx !== -1) iconUrl = schema.resourceIcons.ExpReports[tierIdx] || '';
        }
        enriched.expReports[key] = { amount, name: key, iconUrl };
      }
    }

    // weaponItems
    for (const [key, amount] of Object.entries(req.weaponItems || {})) {
      if ((amount as number) > 0) {
        let iconUrl = '';
        if (schema?.resourceIcons?.WeaponParts) {
            if (key.includes('스프링')) iconUrl = schema.resourceIcons.WeaponParts.Spring[2] || '';
            else if (key.includes('해머')) iconUrl = schema.resourceIcons.WeaponParts.Hammer[2] || '';
            else if (key.includes('총열')) iconUrl = schema.resourceIcons.WeaponParts.Barrel[2] || '';
            else if (key.includes('공이')) iconUrl = schema.resourceIcons.WeaponParts.FiringPin[2] || '';
        }
        enriched.weaponItems[key] = { amount, name: key, iconUrl };
      }
    }

    for (const [key, val] of Object.entries(req.blueprints || {})) {
       if (typeof val === 'object' && val !== null) {
           enriched.blueprints[key] = { amount: (val as any).amount, name: key, iconUrl: (val as any).iconUrl || '', tier: (val as any).tier, type: (val as any).type };
       } else {
           enriched.blueprints[key] = { amount: val as number, name: key, iconUrl: '' };
       }
    }

    // wbs
    for (const [key, amount] of Object.entries(req.wbs || {})) {
       let iconUrl = '';
       if (schema?.resourceIcons?.WBs?.[key]) {
         iconUrl = schema.resourceIcons.WBs[key];
       }
       enriched.wbs[key] = { amount, name: key, iconUrl };
    }

    // ooparts
    for (const [key, amount] of Object.entries(req.ooparts || {})) {
      if ((amount as number) <= 0) continue;
      const isMain = key.includes('(메인)');
      const tierIdx = getTierIdx(key);
      const oopartKey = isMain ? student?.primaryOopart : student?.secondaryOopart;
      
      let specificName = key;
      let iconUrl = '';
      
      if (oopartKey && schema?.ooparts) {
        const def = schema.ooparts.find(o => o.key === oopartKey);
        if (def && def.tiers[tierIdx]) {
          specificName = def.tiers[tierIdx].name;
          iconUrl = def.tiers[tierIdx].iconUrl;
        }
      }
      
      if (!enriched.ooparts[specificName]) {
        enriched.ooparts[specificName] = { amount, name: specificName, iconUrl };
      } else {
        enriched.ooparts[specificName].amount += amount;
      }
    }

    // bds
    for (const [key, amount] of Object.entries(req.bds || {})) {
      if ((amount as number) <= 0) continue;
      const tierIdx = getTierIdx(key);
      const school = student?.school;
      
      let specificName = key;
      let iconUrl = '';
      
      if (school) {
        const schoolLabel = schema?.enums?.School?.values.find(v => v.key === school)?.label || school;
        const prefix = ['기초', '일반', '상급', '최상급'][tierIdx];
        specificName = `${prefix} 전술 교육 BD (${schoolLabel})`;
        if (schema?.resourceIcons?.BDs?.[school]?.[tierIdx]) {
          iconUrl = schema.resourceIcons.BDs[school][tierIdx];
        }
      }
      
      enriched.bds[specificName] = { amount, name: specificName, iconUrl };
    }

    // techNotes
    for (const [key, amount] of Object.entries(req.techNotes || {})) {
      if ((amount as number) <= 0) continue;
      const tierIdx = getTierIdx(key);
      const school = student?.school;
      
      let specificName = key;
      let iconUrl = '';
      
      if (school) {
        const schoolLabel = schema?.enums?.School?.values.find(v => v.key === school)?.label || school;
        const prefix = ['기초', '일반', '상급', '최상급'][tierIdx];
        specificName = `${prefix} 기술 노트 (${schoolLabel})`;
        if (schema?.resourceIcons?.TechNotes?.[school]?.[tierIdx]) {
          iconUrl = schema.resourceIcons.TechNotes[school][tierIdx];
        }
      }
      
      enriched.techNotes[specificName] = { amount, name: specificName, iconUrl };
    }

    return enriched;
  };

  const hasRightPanelOpen = editingPlan || calcResult || combinedResult;

  return (
    <div className="space-y-6 slide-in-right-anim">
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-lg">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <BookOpen className="text-[var(--plana-primary)]" size={28} /> 
            육성 플래너
          </h2>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 hover:bg-pink-50 text-slate-700 rounded-lg font-bold shadow-sm transition-colors border border-slate-200 hover:border-pink-200"
            >
              <Plus size={18} className="text-[var(--plana-primary)]" /> 학생 추가
            </button>
            <button 
              onClick={handleCalculateCombined} 
              disabled={plans.length === 0} 
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              <ShoppingCart size={18} /> 통합 재화 계산
            </button>
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className={`grid ${hasRightPanelOpen ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-6 h-[calc(100vh-250px)] min-h-[600px] max-h-[850px] transition-all duration-300`}>
          
          {/* Left Column: Plan List */}
          <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 h-full min-h-0 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {plans.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-lg border border-dashed border-slate-200 p-10 shadow-sm">
                <BookOpen size={48} className="mb-4 text-slate-300" />
                <p className="text-lg mb-2 font-bold text-slate-500">등록된 육성 계획이 없습니다.</p>
                <p className="text-sm">상단의 [학생 추가] 버튼을 눌러 계획을 세워보세요.</p>
              </div>
            ) : (
              <div className={`grid gap-4 ${hasRightPanelOpen ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                {plans.map(plan => {
                  const student = masterData.find(m => m.id === plan.studentId);
                  return (
                    <PlannerPlanCard 
                      key={plan.id}
                      plan={plan}
                      student={student}
                      isEditing={editingPlan?.id === plan.id}
                      isCalculating={calcResult?.plan?.id === plan.id}
                      onEdit={() => {
                        setEditingPlan({...plan, student});
                        setCalcResult(null);
                        setCombinedResult(null);
                      }}
                      onCalculate={() => handleCalculate(plan)}
                      onDelete={() => handleDeletePlan(plan.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Form or Result */}
          {hasRightPanelOpen && (
            <div className="h-full min-h-0 animate-in slide-in-from-right-4 fade-in duration-300">
              {editingPlan && (
                <PlannerEditForm 
                  editingPlan={editingPlan} 
                  setEditingPlan={setEditingPlan} 
                  onSave={handleSavePlan} 
                />
              )}

              {calcResult && (
                <PlannerCalcResult 
                  data={calcResult.required} 
                  title={`${calcResult.plan.student?.name} 필요 재화`} 
                  schema={schema}
                  onClose={() => setCalcResult(null)}
                />
              )}
              
              {combinedResult && (
                <PlannerCalcResult 
                  data={combinedResult} 
                  title="통합 필요 재화 목록" 
                  isCombined={true}
                  schema={schema}
                  onClose={() => setCombinedResult(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <StudentSelectModal 
          masterData={masterData}
          archiveData={archiveData}
          plans={plans}
          onSelect={handleCreatePlan}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
