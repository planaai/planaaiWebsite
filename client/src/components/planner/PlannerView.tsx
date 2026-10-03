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
import { usePlannerCalc } from '@/hooks/usePlannerCalc';

interface PlannerViewProps {
  masterData: StudentMaster[];
  schema: SchemaConfig | null;
}

export function PlannerView({ masterData, schema }: PlannerViewProps) {
  const { records } = useArchiveStore();
  const archiveData = Object.values(records);
  
  const { plans, addPlan, updatePlan, deletePlan } = usePlannerStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    calcResult,
    setCalcResult,
    combinedResult,
    setCombinedResult,
    editingPlan,
    setEditingPlan,
    handleCalculate,
    handleCalculateCombined
  } = usePlannerCalc(masterData, schema, plans);

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
