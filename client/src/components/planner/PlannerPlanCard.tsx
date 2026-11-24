import React from 'react';
import { SlidersHorizontal, Calculator, Trash2, Star } from 'lucide-react';
import { StudentMaster } from '@/types';
import { getImageUrl } from './utils';

interface PlannerPlanCardProps {
  plan: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  student?: StudentMaster;
  isEditing: boolean;
  isCalculating: boolean;
  onEdit: () => void;
  onCalculate: () => void;
  onDelete: () => void;
}

const ATTACK_TYPE_STYLE: Record<string, { bar: string; badge: string; label: string }> = {
  폭발: { bar: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20', label: '폭발' },
  Explosive: { bar: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20', label: '폭발' },
  관통: { bar: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20', label: '관통' },
  Pierce: { bar: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20', label: '관통' },
  Piercing: { bar: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20', label: '관통' },
  신비: { bar: 'bg-sky-500', badge: 'bg-sky-500/10 text-sky-600 border-sky-500/20', label: '신비' },
  Mystic: { bar: 'bg-sky-500', badge: 'bg-sky-500/10 text-sky-600 border-sky-500/20', label: '신비' },
  진동: { bar: 'bg-purple-500', badge: 'bg-purple-500/10 text-purple-600 border-purple-500/20', label: '진동' },
  Sonic: { bar: 'bg-purple-500', badge: 'bg-purple-500/10 text-purple-600 border-purple-500/20', label: '진동' },
};

function fmtSkill(val: number, max: number) {
  return val >= max ? 'M' : String(val);
}

export function PlannerPlanCard({
  plan,
  student,
  isEditing,
  isCalculating,
  onEdit,
  onCalculate,
  onDelete,
}: PlannerPlanCardProps) {
  const isActive = isEditing || isCalculating;
  const atkStyle =
    ATTACK_TYPE_STYLE[student?.attackType || ''] || {
      bar: 'bg-[var(--plana-primary)]',
      badge: 'bg-pink-50 text-[var(--plana-primary-dark)] border-[var(--plana-border)]',
      label: student?.attackType || '학생',
    };

  const levelPct = Math.min(100, Math.round(((plan.currentLevel || 1) / Math.max(1, plan.targetLevel || 90)) * 100));

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white/90 backdrop-blur-md transition-all duration-200 flex flex-col ${isActive
        ? 'border-[var(--plana-primary-dark)] shadow-md shadow-pink-500/15 ring-1 ring-[var(--plana-primary)]/40'
        : 'border-[var(--plana-border)] shadow-xs hover:border-[var(--plana-primary-dark)] hover:shadow-md'
        }`}
    >
      {/* Semantic Attack Type Accent Bar */}
      < div className={`h-1 w-full ${atkStyle.bar}`} />

      <div className="p-4 flex-1 flex flex-col gap-3.5">
        {/* Top: Portrait + Identity */}
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80">
            {student?.portraitUrls && student.portraitUrls.length > 0 ? (
              <img
                src={getImageUrl(student.portraitUrls[0])}
                alt={student.name || ''}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">No Img</div>
            )}
            <div className="absolute bottom-0.5 right-0.5 bg-slate-900/75 backdrop-blur-xs text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 tabular-nums">
              <Star size={9} className="fill-amber-300" />
              {plan.targetStar}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${atkStyle.badge}`}>
                {atkStyle.label}
              </span>
              {student?.school && (
                <span className="text-[10px] font-semibold text-slate-400 truncate">{student.school}</span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 truncate tracking-tight">
              {student?.name || '알 수 없는 학생'}
            </h3>
            <div className="text-[11px] text-slate-500 tabular-nums mt-0.5 flex items-center gap-1.5">
              <span>
                ★{plan.currentStar} → <strong className="text-rose-500">★{plan.targetStar}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                전무{' '}
                <strong className="text-purple-600">
                  {plan.targetWeaponStar > 0 ? `${plan.targetWeaponStar}성 Lv.${plan.targetWeaponLevel || 30}` : '미착용'}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Spec Progress Grid */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 space-y-2.5 tabular-nums">
          {/* Level Progress */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">LEVEL</span>
              <span className="font-bold text-slate-700">
                Lv.{plan.currentLevel} <span className="text-slate-300 mx-0.5">→</span>{' '}
                <span className="text-[var(--plana-primary-dark)]">Lv.{plan.targetLevel}</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--plana-primary-dark)] transition-all duration-300"
                style={{ width: `${levelPct}%` }}
              />
            </div>
          </div>

          {/* Skills & Equipment */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">SKILL TARGET</span>
              <div className="text-xs font-bold text-slate-800 tracking-tight">
                {fmtSkill(plan.targetEx || 1, 5)} / {fmtSkill(plan.targetBasic || 1, 10)} /{' '}
                {fmtSkill(plan.targetEnh || 1, 10)} / {fmtSkill(plan.targetSub || 1, 10)}
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">EQUIP TIER</span>
              <div className="text-xs font-bold text-slate-800">
                T{plan.targetEquip1 || 0} · T{plan.targetEquip2 || 0} · T{plan.targetEquip3 || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Action Bar */}
        <div className="flex items-center gap-2 pt-1 mt-auto">
          <button
            onClick={onEdit}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.98] ${isEditing
              ? 'bg-[var(--plana-primary-dark)] text-white shadow-xs'
              : 'bg-pink-50/70 hover:bg-pink-100/80 text-[var(--plana-primary-dark)] border border-[var(--plana-border)]'
              }`}
          >
            <SlidersHorizontal size={13} />
            목표 수정
          </button>
          <button
            onClick={onCalculate}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.98] ${isCalculating
              ? 'bg-emerald-500 text-white shadow-xs'
              : 'bg-emerald-50/70 hover:bg-emerald-500 text-emerald-700 hover:text-white border border-emerald-200/80 hover:border-emerald-500'
              }`}
          >
            <Calculator size={13} />
            재화 계산
          </button>
          <button
            onClick={onDelete}
            title="계획 삭제"
            aria-label="계획 삭제"
            className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-slate-200/80 hover:border-rose-200 transition-all duration-200 active:scale-[0.95]"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div >
  );
}
