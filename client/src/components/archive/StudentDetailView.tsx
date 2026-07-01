'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Sword, Shield } from 'lucide-react';
import type { StudentMaster, SchemaConfig, ArchiveRecord } from '@/types';
import { useArchiveStore } from '@/store/archiveStore';
import { RegistrationModal } from './RegistrationModal';
import { computeDiff } from '@/lib/diffUtils';
import { parseTerrainUpgrade } from '@/lib/terrainUtils';
import { SkillSimulator } from './SkillSimulator';

interface StudentDetailViewProps {
  master: StudentMaster;
  schema: SchemaConfig;
}

export function StudentDetailView({ master, schema }: StudentDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'detail' | 'simulator'>('detail');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { records } = useArchiveStore();
  const record = records[master.id] || {
    level: 1, currentStars: master.starNum || 1,
    skillLevels: { ex: 1, normal: 1, passive: 1, sub: 1 },
    equipment: { slot1: null, slot2: null, slot3: null, slot4: null },
    uniqueWeapon: null,
    stats: { maxHP: 0, attackPower: 0, defensePower: 0, healPower: 0 }
  };

  const getLabel = (enumKey: string, valKey: string | undefined) => {
    if (!valKey) return '-';
    return schema.enums[enumKey]?.values?.find(v => v.key === valKey)?.label || valKey;
  };

  const parseDescriptionCore = (template: string, parameters: Record<string, string[]>, lvl: number) => {
    if (!template) return '스킬 효과 설명이 없습니다.';
    let parsed = template;
    const idx = Math.max(0, lvl - 1);

    if (parameters) {
      Object.entries(parameters).forEach(([key, values]) => {
        if (values && values.length > 0) {
          const val = values[Math.min(idx, values.length - 1)];
          const regexStr1 = `<b:\\{\\{?${key}\\}?\\}>`;
          const regexStr2 = `\\{\\{?${key}\\}?\\}`;
          parsed = parsed.replace(new RegExp(regexStr1, 'g'), `<span class="text-blue-500 font-bold">${val}</span>`);
          parsed = parsed.replace(new RegExp(regexStr2, 'g'), val);
        }
      });
    }

    parsed = parsed.replace(/<[^>]*>/g, (match) => {
      if (match.startsWith('<span')) return match;
      if (match === '</span>') return match;
      if (match === '<y>') return '<span class="text-yellow-600 font-bold">';
      if (match === '</y>') return '</span>';
      return '';
    });

    parsed = parsed.replace(/\n/g, '<br />');

    return parsed;
  };

  const parseDescription = (template: string, parameters: Record<string, string[]>, lvl: number, baseTemplate?: string, baseParameters?: Record<string, string[]>) => {
    const parsed = parseDescriptionCore(template, parameters, lvl);

    if (baseTemplate) {
      const baseParsed = parseDescriptionCore(baseTemplate, baseParameters || {}, lvl);
      return computeDiff(baseParsed, parsed);
    }

    return parsed;
  };

  const getEffectiveSkill = (baseKey: string) => {
    const hasT2Fav = (record.equipment?.slot4 as any)?.tier >= 2;
    const has2StarWep = (record.uniqueWeapon?.stars || 0) >= 2;

    if (baseKey === 'normal' && master.skills?.normalPlus?.descriptionTemplate && hasT2Fav) {
      return {
        key: 'normal', label: '기본 스킬+',
        data: {
          ...master.skills.normalPlus,
          name: (master.skills.normal?.name || '') + '+',
          parameters: Object.keys(master.skills.normalPlus.parameters || {}).length > 0 ? master.skills.normalPlus.parameters : master.skills.normal?.parameters,
          iconUrl: master.skills.normalPlus.iconUrl || master.skills.normal?.iconUrl
        },
        baseData: master.skills.normal
      };
    }
    if (baseKey === 'passive' && master.skills?.passivePlus?.descriptionTemplate && has2StarWep) {
      return {
        key: 'passive', label: '강화 스킬+',
        data: {
          ...master.skills.passivePlus,
          name: (master.skills.passive?.name || '') + '+',
          parameters: Object.keys(master.skills.passivePlus.parameters || {}).length > 0 ? master.skills.passivePlus.parameters : master.skills.passive?.parameters,
          iconUrl: master.skills.passivePlus.iconUrl || master.skills.passive?.iconUrl
        },
        baseData: master.skills.passive
      };
    }

    const labelMap: Record<string, string> = { ex: 'EX 스킬', normal: '기본 스킬', passive: '강화 스킬', sub: '서브 스킬' };

    return {
      key: baseKey, label: labelMap[baseKey],
      data: (master.skills as any)?.[baseKey],
      baseData: undefined
    };
  };

  const getTypeColor = (type: string) => {
    if (type === 'Explosion' || type === 'LightArmor') return 'bg-[#D33F4A]';
    if (type === 'Pierce' || type === 'HeavyArmor') return 'bg-[#E3A02C]';
    if (type === 'Mystic' || type === 'Unarmed') return 'bg-[#315B9A]';
    if (type === 'Sonic' || type === 'Vibration' || type === 'ElasticArmor') return 'bg-[#9263A9]';
    if (type === 'Decomposition' || type === 'CompositeArmor') return 'bg-[#0E9AA7]';
    return 'bg-slate-500';
  };

  return (
    <div className="w-full flex flex-col font-sans -mt-4 relative">
      
      {/* Back Button (Top Left) */}
      <div className="mb-5">
        <Link href="/collection" className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-5 py-2 rounded-full text-sm text-[var(--plana-primary)] font-bold shadow-sm border border-white/50 hover:bg-white transition-colors">
          <ArrowLeft size={16} /> 컬렉션으로 돌아가기
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 max-w-[1150px] mx-auto w-full">
        
        {/* Left Column (Illustration & Info) */}
        <div className="lg:w-[440px] shrink-0 relative h-[820px] -translate-x-8">
          {/* Skewed Background & Clipping Container */}
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md border border-white shadow-lg -skew-x-[4deg] rounded-3xl overflow-hidden">
            
            {/* Un-skewed Content Wrapper */}
            <div className="absolute top-0 bottom-0 -left-[40px] -right-[40px] flex flex-col skew-x-[4deg]">
              
              {/* Portrait */}
              <div className="flex-1 relative flex items-center justify-center pt-8">
                {master.fullIllustUrl ? (
                  <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${master.fullIllustUrl}`} className="absolute -bottom-10 w-[130%] max-h-[110%] object-contain object-bottom pointer-events-none" alt={master.name} />
                ) : master.portraitUrl ? (
                  <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${master.portraitUrl}`} className="absolute -bottom-10 w-[110%] max-h-[110%] object-contain pointer-events-none" alt={master.name} />
                ) : (
                  <div className="w-32 h-32 border-2 border-slate-300 text-slate-400 font-bold rounded-2xl flex items-center justify-center bg-white/50 mb-40">
                    일러스트 없음
                  </div>
                )}
              </div>

              {/* Student Info Bar (Bottom) */}
              <div className="relative z-10 w-full py-6 pl-[50px] pr-[78px] bg-gradient-to-t from-white via-white/95 to-transparent pt-16">
                <div className="text-[var(--plana-primary)] font-bold text-xs tracking-wider uppercase mb-1">
                  {getLabel('WeaponType', master.weaponType)}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight">{master.name}</h1>
                    <div className="flex gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map(s => (
                        <svg key={s} className={`w-6 h-6 ${record.currentStars && record.currentStars >= s ? 'text-[#FACC15]' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 text-sm font-bold -skew-x-[15deg]">
                    <div className={`px-6 py-2 text-white shadow-sm whitespace-nowrap tracking-wider flex items-center ${master.fieldType === 'Striker' ? 'bg-[#D33F4A]' : 'bg-[#315B9A]'}`}>
                      <div className="skew-x-[15deg]">{getLabel('FieldType', master.fieldType)}</div>
                    </div>
                  </div>
                </div>

                {/* Badges / Terrain */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
                  <div className="flex gap-2 text-[13px] font-bold -skew-x-[15deg] -translate-x-2">
                    <div className="flex flex-col gap-1.5 w-24">
                      <div className="px-2 py-1 bg-slate-200 text-slate-600 shadow-sm whitespace-nowrap flex items-center justify-center w-full">
                        <div className="skew-x-[15deg]">{getLabel('Role', master.Role)}</div>
                      </div>
                      <div className="px-2 py-1 bg-white border border-slate-200 text-slate-600 shadow-sm whitespace-nowrap flex items-center justify-center w-full flex-1">
                        <div className="skew-x-[15deg]">{getLabel('Position', master.position) || master.position}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className={`px-4 py-1 text-white shadow-sm whitespace-nowrap flex items-center justify-center ${getTypeColor(master.attackType)}`}>
                        <div className="skew-x-[15deg] flex items-center justify-center gap-1.5"><Sword size={14} /> {getLabel('AttackType', master.attackType)}</div>
                      </div>
                      <div className={`px-4 py-1 text-white shadow-sm whitespace-nowrap flex items-center justify-center flex-1 ${getTypeColor(master.armorType)}`}>
                        <div className="skew-x-[15deg] flex items-center justify-center gap-1.5"><Shield size={14} /> {getLabel('ArmorType', master.armorType)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    {(() => {
                      const wepStars = record.uniqueWeapon?.stars || 0;
                      const terrainUpgrade = parseTerrainUpgrade(master.uniqueWeaponEffects?.star3);
                      return [
                        { label: '시가전', val: (wepStars >= 3 && terrainUpgrade?.terrain === 'urban') ? terrainUpgrade.rank : (master.terrainAffinity?.urban || 'B') },
                        { label: '야전', val: (wepStars >= 3 && terrainUpgrade?.terrain === 'outdoor') ? terrainUpgrade.rank : (master.terrainAffinity?.outdoor || 'B') },
                        { label: '실내전', val: (wepStars >= 3 && terrainUpgrade?.terrain === 'indoor') ? terrainUpgrade.rank : (master.terrainAffinity?.indoor || 'B') }
                      ].map((stat, i) => (
                        <div key={i} className="flex flex-col items-center bg-white border border-slate-200 rounded-md p-1.5 shadow-sm w-14">
                          <span className="text-[11px] text-slate-500 font-bold mb-0.5">{stat.label}</span>
                          <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}uploads/misc/${stat.val}.webp`} className="w-8 h-8 object-contain" alt={stat.val} />
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Stats & Skills) */}
        <div className="flex-1 flex flex-col pt-4 h-[820px] overflow-y-auto pr-4 pl-2 -ml-2 pb-10">
          
          {/* Header row: Level & Tabs */}
          <div className="flex justify-between items-end border-b border-[var(--plana-primary)]/20 pb-2 mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-slate-500 tracking-wider">LEVEL</span>
              <span className="text-5xl font-black text-[var(--plana-primary)]">{record.level}</span>
            </div>
            
            <div className="flex gap-1 -skew-x-[15deg]">
              <button
                onClick={() => setActiveTab('detail')}
                className={`px-8 py-2.5 font-bold text-base transition-all ${activeTab === 'detail' ? 'bg-white text-[var(--plana-primary)] shadow-sm' : 'bg-white/50 text-slate-500 hover:bg-white/80'}`}
              >
                <div className="skew-x-[15deg]">상세 정보</div>
              </button>
              <button
                onClick={() => setActiveTab('simulator')}
                className={`px-8 py-2.5 font-bold text-base transition-all ${activeTab === 'simulator' ? 'bg-white text-[var(--plana-primary)] shadow-sm' : 'bg-white/50 text-slate-500 hover:bg-white/80'}`}
              >
                <div className="skew-x-[15deg]">모의 육성</div>
              </button>
            </div>
          </div>

          {activeTab === 'detail' && (
            <div className="space-y-6 pb-12">
              
              {/* 1. 상세 스탯 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h3 className="font-bold text-slate-800 text-base">상세 스탯</h3>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { key: 'maxHP', label: '최대 체력', val: record.stats?.maxHP },
                    { key: 'attackPower', label: '공격력', val: record.stats?.attackPower },
                    { key: 'defensePower', label: '방어력', val: record.stats?.defensePower },
                    { key: 'healPower', label: '치유력', val: record.stats?.healPower }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-4 shadow-sm -skew-x-[10deg] rounded-lg flex flex-col justify-center min-h-[80px]">
                      <div className="skew-x-[10deg]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold text-slate-500">{stat.label}</span>
                          {record.potentialLevels?.[stat.key] ? (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#FF8888] text-white shadow-sm leading-none">
                              Lv.{record.potentialLevels[stat.key]}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-2xl font-black text-[var(--plana-primary)]">{stat.val?.toLocaleString() || '-'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. 고유 스킬 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h3 className="font-bold text-slate-800 text-base">고유 스킬</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {['ex', 'normal', 'passive', 'sub'].map((baseKey, i) => {
                    const skillInfo = getEffectiveSkill(baseKey);
                    const { key, label, data: sData } = skillInfo;
                    if (!sData) return null;
                    const lvl = (record.skillLevels as any)?.[key] || 1;
                    const isMax = (key === 'ex' && lvl === 5) || (key !== 'ex' && lvl === 10);

                    return (
                      <div key={i} className="bg-white p-4 shadow-sm -skew-x-[10deg] rounded-lg flex items-center gap-4 min-h-[100px]">
                        <div className="skew-x-[10deg] flex w-full gap-4 items-center">
                          {/* Icon placeholder */}
                          <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center shrink-0">
                            {sData.iconUrl ? (
                              <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${sData.iconUrl}`} alt={label} className="w-full h-full object-cover rounded-full" />
                            ) : (
                              <span className="text-[10px] font-black text-slate-400">IMG</span>
                            )}
                          </div>
                          
                          {/* Skill Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[11px] font-black px-2 py-0.5 rounded ${isMax ? 'bg-[#FF8888] text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {isMax ? 'MAX' : `Lv.${lvl}`}
                              </span>
                              <span className="font-black text-slate-800 text-sm truncate">{sData.name || label}</span>
                            </div>
                            <div
                              className="text-xs text-slate-600 leading-snug line-clamp-2"
                              dangerouslySetInnerHTML={{ __html: parseDescription(sData.descriptionTemplate, sData.parameters, lvl, skillInfo.baseData?.descriptionTemplate, skillInfo.baseData?.parameters) }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 3. 전용 무기 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h3 className="font-bold text-slate-800 text-base">전용무기</h3>
                </div>
                <div className="bg-white shadow-sm -skew-x-[5deg] rounded-xl overflow-hidden">
                  <div className="skew-x-[5deg] p-5 flex flex-col w-full h-full">
                    <div className="w-full h-28 bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                      {master.uniqueWeaponUrl ? (
                        <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${master.uniqueWeaponUrl}`} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                      ) : (
                        <span className="text-slate-400 font-bold text-sm">이미지 없음</span>
                      )}
                    </div>

                    <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                      <div>
                        <div className="text-[var(--plana-primary)] text-[11px] font-bold mb-1 uppercase tracking-widest">{getLabel('WeaponType', master.weaponType)}</div>
                        <div className="text-xl font-black text-slate-800">{master.uniqueWeaponName || '전용무기'}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        {record.uniqueWeapon ? (
                          <>
                            <div className="text-base font-black text-[#8E73C8]">Lv.{record.uniqueWeapon.level}</div>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map(s => (
                                <svg key={s} className={`w-5 h-5 ${record.uniqueWeapon?.stars && record.uniqueWeapon.stars >= s ? 'text-[#FACC15]' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="px-4 py-1.5 border border-slate-200 text-slate-400 text-xs font-bold bg-slate-50">미착용</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. 작용 장비 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h3 className="font-bold text-slate-800 text-base">작용 장비</h3>
                </div>
                <div className="flex gap-4">
                  {['slot1', 'slot2', 'slot3'].map((slot, i) => {
                    const equipData = (record.equipment as any)?.[slot];
                    const tierNum = equipData?.tier || 1;
                    const level = equipData?.level || 1;
                    const equipCategory = master[`equipmentSlot${i + 1}` as keyof StudentMaster] as string;
                    const equipLabel = getLabel('EquipmentCategory', equipCategory);
                    
                    const equipmentDef = schema.equipments?.find(e => e.key === equipCategory);
                    const equipImage = equipmentDef?.tiers?.[tierNum - 1]?.iconUrl || equipmentDef?.tiers?.[equipmentDef.tiers.length - 1]?.iconUrl || '/images/ui/equip_empty.png';
                    
                    return (
                      <div key={i} className="w-20 h-24 bg-white shadow-sm flex flex-col justify-between p-2 border border-slate-100 relative group cursor-pointer hover:border-[var(--plana-primary)] transition-colors rounded-xl">
                        <div className="text-[11px] font-bold text-[var(--plana-primary)] z-10">Lv.{level}</div>
                        
                        <div className="absolute inset-0 flex justify-center items-center">
                          <img src={equipImage} className="w-14 h-14 object-contain group-hover:scale-110 transition-transform drop-shadow-sm" alt={equipLabel} />
                        </div>
                        
                        <div className="flex justify-end z-10">
                          <div className="text-slate-700 text-[13px] font-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
                            T{tierNum}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex-1 bg-white/50 border border-slate-200 flex items-center justify-center rounded-xl">
                    <Lock size={16} className="text-slate-300" />
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'simulator' && (
            <div className="space-y-6 pb-12">
              <SkillSimulator 
                initialLevels={record.skillLevels}
                master={master}
                schema={schema}
              />
            </div>
          )}

        </div>
      </div>

      {/* Floating Edit Button */}
      <button 
        onClick={() => setIsEditModalOpen(true)}
        className="fixed bottom-10 right-10 z-40 px-6 py-3 bg-[#323646] hover:bg-[#252834] text-white font-bold shadow-lg rounded-xl transition-colors flex items-center gap-2 -skew-x-[15deg]"
      >
        <div className="skew-x-[15deg]">정보 수정</div>
      </button>

      {/* Edit Modal */}
      {schema && (
        <RegistrationModal 
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          masterData={[master]}
          schema={schema}
          initialEditRecord={record}
        />
      )}
    </div>
  );
}
