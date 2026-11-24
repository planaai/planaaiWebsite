'use client';

import React, { useState } from 'react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { BookOpen, ShoppingCart, Plus, Users, ArrowLeft } from 'lucide-react';

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
    handleCalculateCombined,
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

  const isResultMode = Boolean(calcResult || combinedResult);

  return (
    <div className="space-y-5 slide-in-right-anim">
      {/* Shittim Chest Command Header */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl p-5 border border-[var(--plana-border)] shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[var(--plana-primary-light)]/35 border border-[var(--plana-border)] flex items-center justify-center text-[var(--plana-primary-dark)] shrink-0">
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-[TitleV] text-2xl font-bold tracking-tight text-slate-900">
                  육성 플래너
                </h2>
                <span className="inline-block -skew-x-6 bg-[var(--plana-primary-light)]/40 text-[var(--plana-primary-dark)] border border-[var(--plana-border)] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  <span className="inline-block skew-x-6 tabular-nums">{plans.length} STUDENTS</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                학생별 목표 스펙을 설정하고 필요 재화를 계산합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Segment */}
            <div className="inline-flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setCalcResult(null);
                  setCombinedResult(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  !isResultMode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users size={14} /> 육성 목록
              </button>
              <button
                type="button"
                onClick={handleCalculateCombined}
                disabled={plans.length === 0}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-40 ${
                  combinedResult
                    ? 'bg-[var(--plana-primary-dark)] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShoppingCart size={14} /> 통합 재화
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--plana-primary-dark)] hover:bg-pink-500 text-white rounded-xl font-bold text-xs shadow-xs transition-all duration-200 active:scale-[0.98]"
            >
              <Plus size={15} /> 학생 추가
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      {isResultMode ? (
        <div className="space-y-3 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => {
              setCalcResult(null);
              setCombinedResult(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/85 backdrop-blur-md border border-slate-200/80 text-xs font-bold text-slate-600 hover:text-[var(--plana-primary-dark)] hover:border-[var(--plana-primary-dark)]/60 transition-all"
          >
            <ArrowLeft size={14} /> 육성 목록으로 돌아가기
          </button>

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
              title="통합 필요 재화 대시보드"
              isCombined={true}
              schema={schema}
              onClose={() => setCombinedResult(null)}
            />
          )}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-dashed border-[var(--plana-border)] p-14 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--plana-primary-light)]/35 border border-[var(--plana-border)] text-[var(--plana-primary-dark)] flex items-center justify-center mb-4">
            <BookOpen size={28} />
          </div>
          <p className="text-lg font-bold text-slate-800 mb-1">등록된 육성 계획이 없습니다</p>
          <p className="text-xs text-slate-500 mb-5">
            학생을 추가해 목표 성급, 스킬, 장비를 설정하면 필요한 재화와 파밍 루트를 자동으로 계산합니다.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--plana-primary-dark)] hover:bg-pink-500 text-white rounded-xl font-bold text-sm shadow-sm shadow-pink-500/20 transition-all active:scale-[0.98]"
          >
            <Plus size={16} /> 첫 학생 추가하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const student = masterData.find((m) => m.id === plan.studentId);
            return (
              <PlannerPlanCard
                key={plan.id}
                plan={plan}
                student={student}
                isEditing={editingPlan?.id === plan.id}
                isCalculating={calcResult?.plan?.id === plan.id}
                onEdit={() => setEditingPlan({ ...plan, student })}
                onCalculate={() => handleCalculate(plan)}
                onDelete={() => handleDeletePlan(plan.id)}
              />
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingPlan && (
        <PlannerEditForm
          editingPlan={editingPlan}
          setEditingPlan={setEditingPlan}
          onSave={handleSavePlan}
        />
      )}

      {/* Student Select Modal */}
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
