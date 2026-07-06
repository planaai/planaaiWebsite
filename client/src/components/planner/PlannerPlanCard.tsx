import React from 'react';
import { Edit3, Calculator, Trash2 } from 'lucide-react';
import { StudentMaster } from '@/types';
import { getImageUrl } from './utils';

interface PlannerPlanCardProps {
  plan: any;
  student?: StudentMaster;
  isEditing: boolean;
  isCalculating: boolean;
  onEdit: () => void;
  onCalculate: () => void;
  onDelete: () => void;
}

export function PlannerPlanCard({
  plan,
  student,
  isEditing,
  isCalculating,
  onEdit,
  onCalculate,
  onDelete
}: PlannerPlanCardProps) {
  const isActive = isEditing || isCalculating;

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isActive 
        ? 'bg-pink-50 border-pink-300 shadow-md shadow-pink-500/10' 
        : 'bg-white border-slate-200 shadow-sm hover:border-pink-300 hover:shadow-md'
    }`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {student?.portraitUrls && student.portraitUrls.length > 0 ? (
              <img 
                src={getImageUrl(student.portraitUrls[0])} 
                alt="" 
                className={`w-12 h-12 rounded-full object-cover ring-2 ${isActive ? 'ring-[var(--plana-primary)]' : 'ring-slate-200'}`} 
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">No Img</div>
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
              {student?.name || '알 수 없는 학생'}
            </h3>
            <div className="text-xs font-medium text-slate-500 flex flex-wrap gap-x-2 gap-y-1">
              <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-600">
                성급: {plan.currentStar}<span className="text-slate-400 mx-0.5">➔</span><span className="text-[var(--plana-primary)] font-bold">{plan.targetStar}</span>
              </span>
              <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-600">
                Lv: {plan.currentLevel}<span className="text-slate-400 mx-0.5">➔</span><span className="text-blue-500 font-bold">{plan.targetLevel}</span>
              </span>
              <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-600">
                장비: <span className="text-[var(--plana-primary)] font-bold">{plan.targetEquip1}{plan.targetEquip2}{plan.targetEquip3}</span>
              </span>
              <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-600">
                전무: <span className="text-purple-500 font-bold">{plan.targetWeaponStar}성</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 ml-4">
          <button 
            title="수정"
            className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-[var(--plana-primary)] text-white shadow-md' : 'bg-slate-50 border border-slate-200 hover:bg-pink-50 hover:border-pink-200 text-slate-400 hover:text-[var(--plana-primary)]'}`} 
            onClick={onEdit}
          >
            <Edit3 size={18} />
          </button>
          <button 
            title="재화 계산"
            className={`p-2 rounded-lg transition-colors ${isCalculating ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-50 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-slate-400 hover:text-emerald-500'}`} 
            onClick={onCalculate}
          >
            <Calculator size={18} />
          </button>
          <button 
            title="삭제"
            className="p-2 bg-slate-50 border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-500 rounded-lg transition-colors" 
            onClick={onDelete}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
