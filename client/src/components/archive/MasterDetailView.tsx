'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sword, Shield } from 'lucide-react';
import type { StudentMaster, SchemaConfig } from '@/types';
import { computeDiff } from '@/lib/diffUtils';
import { parseTerrainUpgrade } from '@/lib/terrainUtils';
import { SkillSimulator } from './SkillSimulator';

interface MasterDetailViewProps {
  master: StudentMaster;
  schema: SchemaConfig;
}

export function MasterDetailView({ master, schema }: MasterDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'detail' | 'simulator'>('detail');
  const [showSkillMultipliers, setShowSkillMultipliers] = useState<Record<string, boolean>>({});
  const [weaponStars, setWeaponStars] = useState<number>(0);
  const [favTier, setFavTier] = useState<number>(0);

  const getLabel = (enumKey: string, valKey: string | undefined) => {
    if (!valKey) return '-';
    return schema.enums[enumKey]?.values?.find(v => v.key === valKey)?.label || valKey;
  };

  const getAttackColor = (type: string | undefined) => {
    switch (type) {
      case 'Explosion': return 'text-red-500';
      case 'Pierce': return 'text-yellow-500';
      case 'Mystic': return 'text-[var(--plana-primary)]';
      case 'Vibration': return 'text-purple-500';
      default: return 'text-slate-500';
    }
  };

  const getArmorColor = (type: string | undefined) => {
    switch (type) {
      case 'LightArmor': return 'text-red-500';
      case 'HeavyArmor': return 'text-yellow-500';
      case 'MysticArmor': return 'text-[var(--plana-primary)]';
      case 'ElasticArmor': return 'text-purple-500';
      default: return 'text-slate-500';
    }
  };

  const getRoleBg = (role: string | undefined) => {
    return 'bg-transparent border border-slate-300 text-slate-600';
  };

  // 파라미터 파싱 및 교체 (만렙 기준)
  const parseDescriptionCore = (template: string, parameters: Record<string, string[]>, maxIdx: number) => {
    if (!template) return '설명이 없습니다.';
    let parsed = template;
    
    // 단순 파라미터 매칭
    if (parameters) {
      Object.entries(parameters).forEach(([key, values]) => {
        if (values && values.length > 0) {
          const val = values[Math.min(maxIdx, values.length - 1)];
          // <b:{1}>, <b:{{1}}>, {1}, {{1}} 형태 치환 지원
          const regexStr1 = `<b:\\{\\{?${key}\\}?\\}>`;
          const regexStr2 = `\\{\\{?${key}\\}?\\}`;
          parsed = parsed.replace(new RegExp(regexStr1, 'g'), `<span class="text-[var(--plana-primary)] font-bold">${val}</span>`);
          parsed = parsed.replace(new RegExp(regexStr2, 'g'), val);
        }
      });
    }
    
    // 추가적인 태그 제거
    parsed = parsed.replace(/<[^>]*>/g, (match) => {
      if (match.startsWith('<span')) return match;
      if (match === '</span>') return match;
      if (match === '<y>') return '<span class="text-yellow-400 font-bold">';
      if (match === '</y>') return '</span>';
      return '';
    });
    
    parsed = parsed.replace(/\n/g, '<br />');

    return parsed;
  };

  const parseDescription = (template: string, parameters: Record<string, string[]>, isEx: boolean, baseTemplate?: string, baseParameters?: Record<string, string[]>) => {
    const maxIdx = isEx ? 4 : 9; // EX는 5레벨(인덱스 4), 나머지는 10레벨(인덱스 9)
    const parsed = parseDescriptionCore(template, parameters, maxIdx);
    
    if (baseTemplate) {
      const baseParsed = parseDescriptionCore(baseTemplate, baseParameters || {}, maxIdx);
      return computeDiff(baseParsed, parsed);
    }
    
    return parsed;
  };

  const renderMultipliers = (parameters: Record<string, string[]>, isEx: boolean, template?: string) => {
    if (!parameters || Object.keys(parameters).length === 0) return null;
    const maxLvl = isEx ? 5 : 10;
    
    const getParamLabel = (key: string, tmpl?: string) => {
      if (!tmpl) return key;
      const regex = new RegExp(`(.*?)(?:<b:\\{\\{?${key}\\}?\\}>|\\{\\{?${key}\\}?\\})`);
      const match = tmpl.match(regex);
      if (match && match[1]) {
        let beforeText = match[1].replace(/<[^>]*>/g, '');
        beforeText = beforeText.replace(/\{\{?[^{}]+\}\}?/g, ''); 
        beforeText = beforeText.replace(/[%()]/g, '');
        
        let textForMatch = beforeText.replace(/(의|은|는|이|가|을|를|강화율)$/, '').trim();
        const normalize = (s: string) => s.replace(/\s+/g, '').replace(/데미지/g, '대미지');
        const normalizedMatch = normalize(textForMatch);

        const allowedStats = [
          "최대 체력", "공격력", "방어력", "치유력", "명중 수치", "회피 수치", "일반공격 사거리", 
          "받는 회복 효과", "장탄수", "엄폐 성공 수치", "방어 관통 수치", "이동 속도", "공격 속도", 
          "버프 효과 유지력", "군중제어(CC) 지속력", "치명 수치", "치명 저항력", "치명 대미지", 
          "치명 대미지 저항률", "안정 수치", "코스트 회복력", "EX 스킬 코스트", "EX 스킬 추가 소모 코스트", 
          "코스트 오버", "가하는 피해량", "받는 피해량", "피해량 상한", "보호막", "지속 회복", 
          "피격 시 회복", "구호의 마음가짐", "폭발 특효", "관통 특효", "신비 특효", "진동 특효", 
          "기본기 숙련", "집중공격", "약점 파악", "사거리", "CC 저항력", "해로운 효과 유지력", 
          "화상 지속 대미지", "중독 지속 대미지", "오한 지속 대미지", "감전 지속 대미지", "응원의 열기", 
          "저주", "도발", "기절", "공포", "혼란", "동결", "군중제어 강화력", "군중제어 저항력"
        ];
        allowedStats.sort((a, b) => b.length - a.length);

        const matchedStat = allowedStats.find(stat => normalizedMatch.endsWith(normalize(stat)));
        
        if (matchedStat) {
          return matchedStat;
        }
        
        const afterRegex = new RegExp(`(?:<b:\\{\\{?${key}\\}?\\}>|\\{\\{?${key}\\}?\\})([^<]*)`);
        const afterMatch = tmpl.match(afterRegex);
        let afterText = afterMatch ? afterMatch[1].trim() : '';
        if (afterText.startsWith('%')) {
          afterText = afterText.substring(1).trim();
        }
        
        // Fallback for time/count/quantity that are not in the list but very useful
        if (afterText.startsWith('초')) return '시간';
        if (afterText.startsWith('회') && !afterText.startsWith('회복') && !afterText.startsWith('회피')) return '횟수';
        if (afterText.startsWith('개')) return '개수';
        if (afterText.startsWith('배')) return '배율';
        if (afterText.startsWith('명') || afterText.startsWith('인')) return '인원';
      }
      return key;
    };

    return (
      <div className="mt-3 pt-3 border-t border-slate-200/50 flex flex-col gap-1 text-[10px] text-slate-600">
        <div className="font-bold text-slate-500 mb-1">레벨별 배율</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left pr-2 font-bold text-[10px] text-slate-400 pb-1">파라미터</th>
              {Array.from({length: maxLvl}, (_, i) => (
                <th key={i} className="text-center font-bold text-[10px] text-slate-400 pb-1 px-1">Lv.{i+1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(parameters).map(([key, values]) => (
              <tr key={key} className="border-t border-slate-100">
                <td className="pr-2 py-1 font-bold text-slate-500">{getParamLabel(key, template)}</td>
                {Array.from({length: maxLvl}, (_, i) => (
                  <td key={i} className="text-center py-1 px-1">{values[Math.min(i, values.length - 1)]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getAttackBg = (type?: string) => {
    switch(type) {
      case 'Explosion': return 'bg-[#D33F4A]';
      case 'Pierce': return 'bg-[#E3A02C]';
      case 'Mystic': return 'bg-[#315B9A]';
      case 'Sonic': case 'Vibration': return 'bg-[#9263A9]';
      case 'Decomposition': return 'bg-[#0E9AA7]';
      default: return 'bg-slate-500';
    }
  };

  const getArmorBg = (type?: string) => {
    switch(type) {
      case 'LightArmor': return 'bg-[#D33F4A]';
      case 'HeavyArmor': return 'bg-[#E3A02C]';
      case 'Unarmed': return 'bg-[#315B9A]';
      case 'ElasticArmor': return 'bg-[#9263A9]';
      case 'CompositeArmor': return 'bg-[#0E9AA7]';
      default: return 'bg-slate-500';
    }
  };

  const getEffectiveSkill = (baseKey: string) => {
    const hasT2Fav = favTier >= 2;
    const has2StarWep = weaponStars >= 2;

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

  return (
    <div className="w-full flex flex-col font-sans -mt-4 relative">
      
      {/* Back Button (Top Left) */}
      <div className="mb-5">
        <Link href="/archive" className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-5 py-2 rounded-full text-sm text-[var(--plana-primary)] font-bold shadow-sm border border-white/50 hover:bg-white transition-colors">
          <ArrowLeft size={16} /> 도감 목록으로 돌아가기
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
                        <svg key={s} className={`w-6 h-6 ${master.starNum >= s ? 'text-[#FACC15]' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20">
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
                      <div className={`px-4 py-1 text-white shadow-sm whitespace-nowrap flex items-center justify-center ${getAttackBg(master.attackType)}`}>
                        <div className="skew-x-[15deg] flex items-center justify-center gap-1.5"><Sword size={14} /> {getLabel('AttackType', master.attackType)}</div>
                      </div>
                      <div className={`px-4 py-1 text-white shadow-sm whitespace-nowrap flex items-center justify-center flex-1 ${getArmorBg(master.armorType)}`}>
                        <div className="skew-x-[15deg] flex items-center justify-center gap-1.5"><Shield size={14} /> {getLabel('ArmorType', master.armorType)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    {(() => {
                      const wepStars = weaponStars;
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
        <div className="flex-1 flex flex-col pt-4 h-[820px] overflow-y-auto pr-4 pl-2 -ml-2 pb-10 custom-scrollbar">
          
          {/* Header row: Level & Tabs */}
          <div className="flex justify-between items-end border-b border-[var(--plana-primary)]/20 pb-2 mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-slate-500 tracking-wider">LEVEL</span>
              <span className="text-5xl font-black text-[var(--plana-primary)]">90</span>
            </div>
            
            <div className="flex gap-1 -skew-x-[15deg]">
              <button
                onClick={() => setActiveTab('detail')}
                className={`px-8 py-2.5 font-bold text-base transition-all ${activeTab === 'detail' ? 'bg-white text-[var(--plana-primary)] shadow-sm border border-slate-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                <div className="skew-x-[15deg]">상세 정보</div>
              </button>
              <button
                onClick={() => setActiveTab('simulator')}
                className={`px-8 py-2.5 font-bold text-base transition-all ${activeTab === 'simulator' ? 'bg-white text-[var(--plana-primary)] shadow-sm border border-slate-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                <div className="skew-x-[15deg]">모의 육성</div>
              </button>
            </div>
          </div>

          {activeTab === 'detail' && (
            <div className="space-y-6 pb-12">
              
              {/* 2. 고유 스킬 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h3 className="font-bold text-slate-800 text-base">고유 스킬</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {['ex', 'normal', 'passive', 'sub'].map((baseKey, i) => {
                    const skillInfo = getEffectiveSkill(baseKey);
                    const { key, label, data: sData } = skillInfo;
                    if (!sData) return null;
                    const isExpanded = showSkillMultipliers[key];
                    const hasParams = sData.parameters && Object.keys(sData.parameters).length > 0;

                    return (
                      <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
                        {/* Skill Header — always visible, clickable to expand */}
                        <button
                          onClick={() => setShowSkillMultipliers(prev => ({...prev, [key]: !prev[key]}))}
                          className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50/50 transition-colors"
                        >
                          {/* Icon */}
                          <div className="w-14 h-14 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                            {sData.iconUrl ? (
                              <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${sData.iconUrl}`} alt={label} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-black text-slate-400">IMG</span>
                            )}
                          </div>
                          
                          {/* Name & Level */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-black px-2 py-0.5 rounded bg-[#FF8888] text-white shrink-0">
                                MAX
                              </span>
                              <span className="font-black text-slate-800 text-sm truncate">{sData.name || label}</span>
                            </div>
                            {/* 접힌 상태: 설명 한 줄만 미리보기 */}
                            {!isExpanded && (
                              <div
                                className="text-xs text-slate-500 leading-snug line-clamp-1"
                                dangerouslySetInnerHTML={{ __html: parseDescription(sData.descriptionTemplate, sData.parameters, key === 'ex', skillInfo.baseData?.descriptionTemplate, skillInfo.baseData?.parameters) }}
                              />
                            )}
                          </div>

                          {/* Expand indicator */}
                          <div className={`text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                          </div>
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-slate-100 animate-fade-in">
                            {/* Full description */}
                            <div
                              className="text-xs text-slate-600 leading-relaxed mt-3 bg-slate-50 rounded-lg p-3"
                              dangerouslySetInnerHTML={{ __html: parseDescription(sData.descriptionTemplate, sData.parameters, key === 'ex', skillInfo.baseData?.descriptionTemplate, skillInfo.baseData?.parameters) }}
                            />
                            
                            {/* Multiplier table */}
                            {hasParams && (
                              <div className="mt-3">
                                {renderMultipliers(sData.parameters, key === 'ex', sData.descriptionTemplate)}
                              </div>
                            )}
                          </div>
                        )}
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
                <div className="bg-white shadow-sm -skew-x-[5deg] rounded-xl overflow-hidden border border-slate-100">
                  <div className="skew-x-[5deg] p-5 flex flex-col w-full h-full">
                    <div className="w-full h-28 bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 rounded-lg">
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
                        <button onClick={() => setWeaponStars(0)} className={`px-4 py-1.5 border rounded-md text-xs font-bold transition-colors ${weaponStars === 0 ? 'bg-slate-700 text-white border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>미착용</button>
                        <div className="w-px h-4 bg-slate-200"></div>
                        <div className="flex gap-3">
                          {[1, 2, 3, 4].map(s => (
                            <button key={s} onClick={() => setWeaponStars(s)} className={`flex items-center justify-center transition-colors ${weaponStars >= s ? 'text-[#FACC15] drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'text-slate-200 hover:text-slate-300'}`}>
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 text-xs text-slate-600 items-end mt-3">
                      {weaponStars >= 2 && master.uniqueWeaponEffects?.star2 && (
                        <div className="flex gap-2 items-center">
                          <span className="text-[var(--plana-primary)] font-black tracking-widest">★2</span>
                          <span className="font-medium text-right">{master.uniqueWeaponEffects.star2}</span>
                        </div>
                      )}
                      {weaponStars >= 3 && master.uniqueWeaponEffects?.star3 && (
                        <div className="flex gap-2 items-center">
                          <span className="text-[var(--plana-primary)] font-black tracking-widest">★3</span>
                          <span className="font-medium text-right">{master.uniqueWeaponEffects.star3}</span>
                        </div>
                      )}
                      {weaponStars >= 4 && master.uniqueWeaponEffects?.star4 && (
                        <div className="flex gap-2 items-center">
                          <span className="text-[var(--plana-primary)] font-black tracking-widest">★4</span>
                          <span className="font-medium text-right">{master.uniqueWeaponEffects.star4}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. 착용 장비 및 애장품 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h3 className="font-bold text-slate-800 text-base">착용 장비</h3>
                </div>
                <div className="flex gap-4">
                  {[master.equipmentSlot1, master.equipmentSlot2, master.equipmentSlot3].map((slotType, i) => (
                    <div key={i} className="w-24 h-24 bg-white shadow-sm flex flex-col justify-center items-center p-2 border border-slate-200 rounded-2xl relative overflow-hidden">
                      <div className="text-[11px] font-bold text-slate-400 absolute top-2 right-2">T9</div>
                      <div className="flex-1 flex justify-center items-center relative">
                        <div className="z-10 text-[10px] font-bold text-slate-500 uppercase">{slotType || 'NONE'}</div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Favorite Item Card */}
                  {master.hasFavoriteItem && (
                    <div className="flex-1 bg-white border border-pink-200 rounded-2xl flex flex-col p-3 relative shadow-sm">
                      <div className="flex">
                        <div className="w-16 h-16 mr-4 flex-shrink-0 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
                          {master.favoriteItemUrl ? (
                            <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${master.favoriteItemUrl}`} className="w-full h-full object-contain drop-shadow-md mix-blend-multiply" />
                          ) : (
                            <span className="text-slate-400 text-[10px] font-bold">이미지 없음</span>
                          )}
                        </div>
                        <div className="flex flex-col justify-between flex-1 py-0.5">
                          <div className="flex justify-between items-start">
                            <div className="text-slate-600 font-bold text-sm">애장품</div>
                          </div>
                          <div className="flex gap-1.5 mt-auto">
                            <button onClick={() => setFavTier(0)} className={`px-2 py-1 rounded-md border text-[10px] font-bold transition-colors ${favTier === 0 ? 'bg-slate-700 text-white border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>미착용</button>
                            {[1, 2].map(t => (
                              <button key={t} onClick={() => setFavTier(t)} className={`flex items-center justify-center px-3 py-1 rounded-md border text-xs font-black transition-colors ${favTier >= t ? 'bg-pink-100 text-pink-600 border-pink-300' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'}`}>
                                T{t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Favorite Item Effects */}
                      {((favTier >= 1 && master.favoriteItemEffects?.t1) || (favTier >= 2 && master.favoriteItemEffects?.t2)) && (
                        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col gap-1 text-xs text-slate-600">
                          {favTier >= 1 && master.favoriteItemEffects?.t1 && (
                            <div className="flex gap-2 items-center">
                              <span className="text-pink-500 font-black">T1</span>
                              <span className="font-medium">{master.favoriteItemEffects.t1}</span>
                            </div>
                          )}
                          {favTier >= 2 && master.favoriteItemEffects?.t2 && (
                            <div className="flex gap-2 items-center">
                              <span className="text-pink-500 font-black">T2</span>
                              <span className="font-medium">{master.favoriteItemEffects.t2}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. 선호하는 선물 */}
              {schema.gifts && schema.gifts.some(g => g.affinity.level2.includes(master.id) || g.affinity.level3.includes(master.id) || g.affinity.level4.includes(master.id)) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                    <h3 className="font-bold text-slate-800 text-base">선호하는 선물</h3>
                  </div>
                  <div className="flex flex-col gap-4">
                    {/* Level 4 Gifts */}
                    {schema.gifts.filter(g => g.affinity.level4.includes(master.id)).length > 0 && (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="w-16 shrink-0 flex flex-col items-center justify-center">
                          {schema.resourceIcons?.Affinity?.level4 ? (
                            <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${schema.resourceIcons.Affinity.level4}`} alt="매우 선호" className="w-8 h-8 object-contain drop-shadow-md" />
                          ) : (
                            <span className="text-[10px] font-black text-pink-500 bg-pink-100 border border-pink-200 px-2 py-1 rounded">매우 선호</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 border-l border-slate-200 pl-3">
                          {schema.gifts.filter(g => g.affinity.level4.includes(master.id)).map(g => (
                            <div key={g.key} className={`group relative w-16 h-16 ${g.tier === 'HighGrade' ? 'bg-pink-50' : 'bg-slate-50'} rounded-lg overflow-hidden flex items-center justify-center hover:brightness-95 transition-colors shadow-sm`} title={g.name}>
                              {g.iconUrl ? <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${g.iconUrl}`} alt={g.name} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform drop-shadow-sm" /> : <span className="text-[8px] text-slate-400 text-center px-1">NO IMG</span>}
                              <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity p-1">
                                <span className="text-slate-800 text-[9px] font-bold text-center leading-tight line-clamp-3">{g.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Level 3 Gifts */}
                    {schema.gifts.filter(g => g.affinity.level3.includes(master.id)).length > 0 && (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="w-16 shrink-0 flex flex-col items-center justify-center">
                          {schema.resourceIcons?.Affinity?.level3 ? (
                            <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${schema.resourceIcons.Affinity.level3}`} alt="선호" className="w-7 h-7 object-contain drop-shadow-md" />
                          ) : (
                            <span className="text-[10px] font-black text-blue-500 bg-blue-100 border border-blue-200 px-2 py-1 rounded">선호</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 border-l border-slate-200 pl-3">
                          {schema.gifts.filter(g => g.affinity.level3.includes(master.id)).map(g => (
                            <div key={g.key} className={`group relative w-16 h-16 ${g.tier === 'HighGrade' ? 'bg-pink-50' : 'bg-slate-50'} rounded-lg overflow-hidden flex items-center justify-center hover:brightness-95 transition-colors shadow-sm`} title={g.name}>
                              {g.iconUrl ? <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${g.iconUrl}`} alt={g.name} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform drop-shadow-sm" /> : <span className="text-[8px] text-slate-400 text-center px-1">NO IMG</span>}
                              <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity p-1">
                                <span className="text-slate-800 text-[9px] font-bold text-center leading-tight line-clamp-3">{g.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Level 2 Gifts */}
                    {schema.gifts.filter(g => g.affinity.level2.includes(master.id)).length > 0 && (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="w-16 shrink-0 flex flex-col items-center justify-center">
                          {schema.resourceIcons?.Affinity?.level2 ? (
                            <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${schema.resourceIcons.Affinity.level2}`} alt="약간 선호" className="w-6 h-6 object-contain drop-shadow-md" />
                          ) : (
                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded">약간 선호</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 border-l border-slate-200 pl-3">
                          {schema.gifts.filter(g => g.affinity.level2.includes(master.id)).map(g => (
                            <div key={g.key} className={`group relative w-16 h-16 ${g.tier === 'HighGrade' ? 'bg-pink-50' : 'bg-slate-50'} rounded-lg overflow-hidden flex items-center justify-center hover:brightness-95 transition-colors shadow-sm opacity-90 hover:opacity-100`} title={g.name}>
                              {g.iconUrl ? <img src={`${process.env.NEXT_PUBLIC_API_URL || ''}${g.iconUrl}`} alt={g.name} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform drop-shadow-sm" /> : <span className="text-[8px] text-slate-400 text-center px-1">NO IMG</span>}
                              <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity p-1">
                                <span className="text-slate-800 text-[9px] font-bold text-center leading-tight line-clamp-3">{g.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'simulator' && (
            <div className="space-y-6 pb-12 mt-4">
              <SkillSimulator 
                initialLevels={{ ex: 1, normal: 1, passive: 1, sub: 1 }}
                master={master}
                schema={schema}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );

}
