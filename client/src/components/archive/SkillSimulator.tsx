'use client';

import React, { useState, useMemo } from 'react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { calculateSkillCosts, createEmptyMaterialAccumulator } from '@/lib/skillCostUtils';
import { getTierColor } from '@/lib/itemColors';
import { getImageUrl } from '../planner/utils';

interface SkillSimulatorProps {
  initialLevels: { ex: number; normal: number; passive: number; sub: number };
  master: StudentMaster;
  schema: SchemaConfig;
}

export function SkillSimulator({ initialLevels, master, schema }: SkillSimulatorProps) {
  const [targetLevels, setTargetLevels] = useState(initialLevels);

  const costs = useMemo(() => {
    return calculateSkillCosts(initialLevels, targetLevels);
  }, [initialLevels, targetLevels]);

  const handleSliderChange = (skill: keyof typeof initialLevels, value: number) => {
    // Cannot go below initial level
    const clamped = Math.max(initialLevels[skill], value);
    setTargetLevels(prev => ({ ...prev, [skill]: clamped }));
  };

  const getOopartLabel = (key: string) => {
    return schema.ooparts?.find(o => o.key === key)?.label || key;
  };

  const getSchoolLabel = (key: string) => {
    return schema.enums.School?.values?.find(v => v.key === key)?.label || key;
  };

  const renderMaterialBadge = (tier: number, label: string, amount: number, iconUrl?: string) => {
    const color = getTierColor(tier);
    return (
      <div key={`${label}-${tier}`} className="flex flex-col items-center justify-center p-2 rounded-xl bg-white shadow-sm relative overflow-hidden group" style={{ border: `1px solid ${color.border}` }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ background: color.gradient }} />
        <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-2 border relative shadow-inner" style={{ background: color.gradient, borderColor: color.border }}>
          {iconUrl ? (
            <img src={getImageUrl(iconUrl)} alt={label} className="w-10 h-10 object-contain drop-shadow-md" />
          ) : (
            <span className="text-xl font-black opacity-80" style={{ color: color.text }}>T{tier}</span>
          )}
        </div>
        <span className="text-[10px] text-slate-600 text-center leading-tight h-6 font-bold z-10">{label}</span>
        <div className="mt-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-bold text-slate-700 z-10 tabular-nums shadow-sm">
          x{amount}
        </div>
      </div>
    );
  };

  const renderSliders = () => {
    const skills = [
      { key: 'ex' as const, label: 'EX 스킬', max: 5 },
      { key: 'normal' as const, label: '기본 스킬', max: 10 },
      { key: 'passive' as const, label: '강화 스킬', max: 10 },
      { key: 'sub' as const, label: '서브 스킬', max: 10 },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.map(s => (
          <div key={s.key} className="bg-white p-4 shadow-sm -skew-x-[10deg] rounded-lg flex flex-col justify-center min-h-[100px]">
            <div className="skew-x-[10deg] flex flex-col gap-3">
              <div className="flex justify-between items-center px-1">
                <span className="font-black text-slate-800">{s.label}</span>
                {initialLevels[s.key] === s.max ? (
                  <span className="text-[#FF8888] font-black text-sm px-2 py-0.5 rounded bg-[#FF8888]/10">MAX</span>
                ) : (
                  <div className="flex items-center gap-2 bg-[var(--plana-primary)]/10 rounded px-3 py-1 text-slate-600">
                    <span className="text-slate-500 text-xs font-black">Lv.{initialLevels[s.key]}</span>
                    <span className="text-slate-400 text-xs">→</span>
                    <span className="text-[var(--plana-primary)] text-xs font-black">Lv.{targetLevels[s.key]}</span>
                  </div>
                )}
              </div>
              {initialLevels[s.key] === s.max ? (
                <div className="w-full py-2 flex items-center justify-center bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-400">해당 스킬은 이미 육성이 완료되었습니다.</span>
                </div>
              ) : (
                <>
                  <input
                    type="range"
                    min={1}
                    max={s.max}
                    value={targetLevels[s.key]}
                    onChange={(e) => handleSliderChange(s.key, parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--plana-primary)]"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 px-2 font-bold">
                    <span>1</span>
                    <span>{s.max}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getTierPrefix = (tier: number) => {
    switch (tier) {
      case 1: return '기초';
      case 2: return '일반';
      case 3: return '상급';
      case 4: return '최상급';
      default: return `T${tier}`;
    }
  };

  const renderRequiredMaterials = () => {
    const items: React.ReactNode[] = [];
    const schoolName = getSchoolLabel(master.school);

    // BDs
    Object.entries(costs.bd).forEach(([tierStr, amount]) => {
      const tier = parseInt(tierStr);
      const bdName = `${getTierPrefix(tier)} 전술 교육 BD (${schoolName})`;
      const iconUrl = schema.resourceIcons?.BDs?.[master.school]?.[tier - 1];
      items.push(renderMaterialBadge(tier, bdName, amount, iconUrl));
    });

    // TechNotes
    Object.entries(costs.tn).forEach(([tierStr, amount]) => {
      const tier = parseInt(tierStr);
      const tnName = `${getTierPrefix(tier)} 기술 노트 (${schoolName})`;
      const iconUrl = schema.resourceIcons?.TechNotes?.[master.school]?.[tier - 1];
      items.push(renderMaterialBadge(tier, tnName, amount, iconUrl));
    });

    // Primary Ooparts
    if (master.primaryOopart) {
      const label = getOopartLabel(master.primaryOopart);
      const oopartSchema = schema.ooparts?.find(o => o.key === master.primaryOopart);
      Object.entries(costs.primary).forEach(([tierStr, amount]) => {
        const tier = parseInt(tierStr);
        const iconUrl = oopartSchema?.tiers?.[tier - 1]?.iconUrl;
        const tierName = oopartSchema?.tiers?.[tier - 1]?.name || label;
        items.push(renderMaterialBadge(tier, tierName, amount, iconUrl));
      });
    }

    // Secondary Ooparts
    if (master.secondaryOopart) {
      const label = getOopartLabel(master.secondaryOopart);
      const oopartSchema = schema.ooparts?.find(o => o.key === master.secondaryOopart);
      Object.entries(costs.secondary).forEach(([tierStr, amount]) => {
        const tier = parseInt(tierStr);
        const iconUrl = oopartSchema?.tiers?.[tier - 1]?.iconUrl;
        const tierName = oopartSchema?.tiers?.[tier - 1]?.name || label;
        items.push(renderMaterialBadge(tier, tierName, amount, iconUrl));
      });
    }

    if (costs.secret > 0) {
      items.push(
        <div key="secret" className="flex flex-col items-center justify-center p-2 rounded-xl bg-white shadow-sm relative overflow-hidden group" style={{ border: '1px solid #fcd34d' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-[0.03]" />
          <div className="w-14 h-14 rounded-lg flex items-center justify-center shadow-inner mb-2 border border-amber-300 bg-gradient-to-br from-amber-100 to-amber-300 relative">
            {schema.resourceIcons?.SecretTechSheet ? (
              <img src={getImageUrl(schema.resourceIcons.SecretTechSheet)} alt="비의서" className="w-10 h-10 object-contain drop-shadow-md" />
            ) : (
              <span className="text-[28px]">📜</span>
            )}
          </div>
          <span className="text-[10px] text-amber-700 text-center leading-tight h-6 font-bold z-10">비의서</span>
          <div className="mt-1 bg-white border border-amber-200 rounded px-2 py-0.5 text-xs font-bold text-amber-700 z-10 tabular-nums shadow-sm">
            x{costs.secret}
          </div>
        </div>
      );
    }

    if (items.length === 0 && costs.credit === 0) {
      return (
        <div className="bg-white shadow-sm -skew-x-[5deg] rounded-lg p-12 flex justify-center items-center border border-slate-100">
          <span className="skew-x-[5deg] text-slate-400 font-bold">육성할 스킬 레벨을 올려주세요.</span>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-slate-50 border border-slate-200 p-4 shadow-sm -skew-x-[10deg] rounded-lg flex justify-between items-center">
          <div className="skew-x-[10deg] flex justify-between items-center w-full px-2">
            <span className="text-sm font-bold text-slate-600 tracking-wider">필요 크레딧</span>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-500 text-2xl font-black tabular-nums">{costs.credit.toLocaleString()}</span>
              {schema.resourceIcons?.Credit ? (
                <img src={getImageUrl(schema.resourceIcons.Credit)} alt="C" className="w-10 h-10 object-contain drop-shadow-sm" />
              ) : (
                <span className="text-amber-500/70 font-bold">C</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm -skew-x-[5deg] rounded-lg border border-slate-100">
          <div className="skew-x-[5deg] grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {items}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 slide-in-right-anim pb-12">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
          <h3 className="font-bold text-slate-800 text-base">스킬 레벨 설정</h3>
        </div>
        {renderSliders()}
      </div>
      
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
          <h3 className="font-bold text-slate-800 text-base">필요 성장 재화</h3>
        </div>
        {renderRequiredMaterials()}
      </div>
    </div>
  );
}
