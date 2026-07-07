import { useState } from 'react';
import { X, Save, Star } from 'lucide-react';
import type { StudentMaster, SchemaConfig, Skill } from '../../types';
import { PortraitUpload, IllustUpload, SkillInput, Select, FavoriteItemUpload, UniqueWeaponUpload, TextInput, ComboBox } from '../ui';
import { EtcSkillCostInput } from './EtcSkillCostInput';

interface MasterModalProps {
  student: Omit<StudentMaster, 'id'> & { id?: number };
  isNew: boolean;
  schema: SchemaConfig;
  onSave: (data: Omit<StudentMaster, 'id'> & { id?: number }) => void;
  onClose: () => void;
  showToast: (m: string, t?: 'error') => void;
}

export function MasterModal({ student, isNew, schema, onSave, onClose, showToast }: MasterModalProps) {
  const [form, setForm] = useState(student);
  const [showSummon, setShowSummon] = useState(!!student.summon);
  
  const [activeSkillIndex, setActiveSkillIndex] = useState(0);

  const updateSkill = (index: number, key: 'ex' | 'normal' | 'passive' | 'sub' | 'normalPlus' | 'passivePlus', newSkill: Skill) => 
    setForm(prev => {
      const skills = [...(prev.skills || [])];
      if (!skills[index]) {
        skills[index] = { ex: {} as Skill, normal: {} as Skill, passive: {} as Skill, sub: {} as Skill };
      }
      skills[index] = { ...skills[index], [key]: newSkill };
      return { ...prev, skills };
    });

  const addSkillSet = () => {
    setForm(prev => ({
      ...prev,
      skills: [...(prev.skills || []), { ex: {} as Skill, normal: {} as Skill, passive: {} as Skill, sub: {} as Skill }]
    }));
    setActiveSkillIndex((form.skills?.length || 0));
  };

  const removeSkillSet = (index: number) => {
    setForm(prev => {
      const skills = [...(prev.skills || [])];
      skills.splice(index, 1);
      return { ...prev, skills };
    });
    if (activeSkillIndex >= index && activeSkillIndex > 0) setActiveSkillIndex(activeSkillIndex - 1);
  };

  const updatePortrait = (url: string) => {
    setForm(prev => {
      const urls = [...(prev.portraitUrls || [])];
      urls[0] = url;
      return { ...prev, portraitUrls: urls };
    });
  };

  const updateIllustUrl = (index: number, url: string) => {
    setForm(prev => {
      const urls = [...(prev.portraitUrls || [])];
      urls[index + 1] = url;
      return { ...prev, portraitUrls: urls };
    });
  };

  const addIllustUrl = () => {
    setForm(prev => {
      const urls = [...(prev.portraitUrls || [])];
      if (urls.length === 0) urls.push(''); // Ensure portrait slot exists
      urls.push('');
      return { ...prev, portraitUrls: urls };
    });
  };

  const removeIllustUrl = (index: number) => {
    setForm(prev => {
      const urls = [...(prev.portraitUrls || [])];
      urls.splice(index + 1, 1);
      return { ...prev, portraitUrls: urls };
    });
  };

  const isEtc = ['기타', 'etc', 'ETC'].includes(form.school);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h2 className="text-xl font-bold text-white">{isNew ? '신규 마스터 데이터 추가' : `✏️ ${form.name} 마스터 수정`}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-8">
            <div>
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">기본 정보</h3>
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 sm:col-span-3 flex flex-col items-center sm:items-start gap-4 border-r border-slate-700/50 pr-4">
                  <div className="w-full flex flex-col gap-4 items-center sm:items-start">
                    <div className="w-full">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">초상화</label>
                      <div className="border border-slate-700/50 p-2 rounded-lg flex justify-center bg-slate-800/30">
                        <PortraitUpload url={form.portraitUrls?.[0] || ''} onChange={updatePortrait} showToast={showToast} />
                      </div>
                    </div>

                    <div className="w-full">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">전신 일러스트</label>
                        <button onClick={addIllustUrl} className="text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 px-2 py-1 rounded border border-blue-500/20 transition-colors">+ 추가</button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {(form.portraitUrls?.slice(1) || []).map((url, idx) => (
                          <div key={idx} className="w-full flex flex-col border border-slate-700/50 p-2 rounded-lg relative bg-slate-800/30">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] text-slate-500 font-bold">일러스트 {idx + 1}</span>
                              <button onClick={() => removeIllustUrl(idx)} className="text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-slate-700"><X size={12} /></button>
                            </div>
                            <div className="flex justify-center w-full">
                              <IllustUpload url={url} onChange={newUrl => updateIllustUrl(idx, newUrl)} showToast={showToast} />
                            </div>
                          </div>
                        ))}
                        {(!form.portraitUrls || form.portraitUrls.length <= 1) && (
                          <div className="text-[10px] text-slate-500 text-center w-full py-4 border border-dashed border-slate-700 rounded-lg bg-slate-800/10">
                            일러스트가 없습니다.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-12 sm:col-span-9 grid grid-cols-2 gap-4">
                  <div className="col-span-1 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">학생 번호</label>
                    <input type="number" value={form.studentNumber || ''} onChange={e => setForm({ ...form, studentNumber: e.target.value ? Number(e.target.value) : undefined })} placeholder="도감 번호" className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30" />
                  </div>
                  <div className="col-span-1 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">이름</label>
                    <TextInput value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="학생 이름" className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30" />
                  </div>
                  <Select label="학교" value={form.school} onChange={v => setForm({ ...form, school: v })} options={schema.enums.School?.values || []} />
                  <ComboBox label="동아리" value={form.club || ''} onChange={v => setForm({ ...form, club: v })} options={schema.enums.Club?.values || []} />
                  <Select label="부대 유형" value={form.fieldType || ''} onChange={v => setForm({ ...form, fieldType: v })} options={schema.enums.FieldType?.values || []} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">기본 등급 (★)</label>
                    <div className="flex items-center gap-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 h-[42px]">
                      {[1,2,3].map(s => (
                        <Star key={s} size={20} className={`cursor-pointer transition-colors ${s <= (form.starNum || 1) ? 'fill-yellow-400 text-yellow-400' : 'fill-slate-600 text-slate-600 hover:fill-yellow-600 hover:text-yellow-600'}`}
                          onClick={() => setForm({ ...form, starNum: s })} />
                      ))}
                      <span className="text-[10px] text-slate-500 ml-1">획득 시</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">애장품</label>
                    <div className="flex items-center gap-3 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 h-[42px]">
                      <input type="checkbox" checked={form.hasFavoriteItem || false} onChange={e => setForm({ ...form, hasFavoriteItem: e.target.checked })} className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-500 focus:ring-2" />
                      <span className="text-sm text-white">애장품 보유</span>
                    </div>
                  </div>
                  <Select label="포지션" value={form.position} onChange={v => setForm({ ...form, position: v })} options={schema.enums.Position?.values || []} />
                  <Select label="보조 포지션 (선택)" value={form.position2 || ''} onChange={v => setForm({ ...form, position2: v })} options={schema.enums.Position?.values || []} />
                  <Select label="역할" value={form.Role} onChange={v => setForm({ ...form, Role: v })} options={schema.enums.Role?.values || []} />
                  <Select label="보조 역할 (선택)" value={form.Role2 || ''} onChange={v => setForm({ ...form, Role2: v })} options={schema.enums.Role?.values || []} />
                  <Select label="무기 종류" value={form.weaponType} onChange={v => setForm({ ...form, weaponType: v })} options={schema.enums.WeaponType?.values || []} />
                  <Select label="공격 속성" value={form.attackType} onChange={v => setForm({ ...form, attackType: v })} options={schema.enums.AttackType?.values || []} />
                  <Select label="방어 속성" value={form.armorType} onChange={v => setForm({ ...form, armorType: v })} options={schema.enums.ArmorType?.values || []} />
                  
                  <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-700/50 pt-4 mt-2">
                    <Select label="장비 1 (모자/장갑/신발)" value={form.equipmentSlot1 || ''} onChange={v => setForm({ ...form, equipmentSlot1: v })} options={schema.enums.EquipmentSlot1?.values || []} />
                    <Select label="장비 2 (배지/가방/헤어핀)" value={form.equipmentSlot2 || ''} onChange={v => setForm({ ...form, equipmentSlot2: v })} options={schema.enums.EquipmentSlot2?.values || []} />
                    <Select label="장비 3 (부적/시계/목걸이)" value={form.equipmentSlot3 || ''} onChange={v => setForm({ ...form, equipmentSlot3: v })} options={schema.enums.EquipmentSlot3?.values || []} />
                  </div>
                  
                  {!isEtc && (
                    <div className="col-span-2 grid grid-cols-2 gap-4 mt-2 pt-4 border-t border-slate-700/50">
                      <Select label="주 오파츠" value={form.primaryOopart || ''} onChange={v => setForm({ ...form, primaryOopart: v })} options={schema.ooparts?.map(o => ({ key: o.key, label: o.label })) || []} />
                      <Select label="부 오파츠" value={form.secondaryOopart || ''} onChange={v => setForm({ ...form, secondaryOopart: v })} options={schema.ooparts?.map(o => ({ key: o.key, label: o.label })) || []} />
                    </div>
                  )}

                  <div className="col-span-1 sm:col-span-2 grid grid-cols-3 gap-4 border-t border-slate-700/50 pt-4 mt-2">
                    <Select label="시가지 전투력" value={form.terrainAffinity?.urban || 'B'} onChange={v => setForm({ ...form, terrainAffinity: { ...(form.terrainAffinity || { urban: 'B', outdoor: 'B', indoor: 'B' }), urban: v } })} options={schema.enums.TerrainRank?.values || []} />
                    <Select label="야외 전투력" value={form.terrainAffinity?.outdoor || 'B'} onChange={v => setForm({ ...form, terrainAffinity: { ...(form.terrainAffinity || { urban: 'B', outdoor: 'B', indoor: 'B' }), outdoor: v } })} options={schema.enums.TerrainRank?.values || []} />
                    <Select label="실내 전투력" value={form.terrainAffinity?.indoor || 'B'} onChange={v => setForm({ ...form, terrainAffinity: { ...(form.terrainAffinity || { urban: 'B', outdoor: 'B', indoor: 'B' }), indoor: v } })} options={schema.enums.TerrainRank?.values || []} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                <h3 className="text-sm font-bold text-teal-400 uppercase tracking-wider">소환수 정보 (T.S / 매지컬 전용)</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[10px] text-slate-400 font-bold">소환수 사용</span>
                  <input
                    type="checkbox"
                    checked={showSummon}
                    onChange={e => {
                      setShowSummon(e.target.checked);
                      if (!e.target.checked) {
                        const { summon, ...rest } = form;
                        setForm(rest);
                      } else if (!form.summon) {
                        setForm({ ...form, summon: { entityName: '', duration: 0, statInheritance: {} } });
                      }
                    }}
                    className="w-4 h-4 text-teal-500 bg-slate-700 border-slate-500 rounded focus:ring-teal-500"
                  />
                </label>
              </div>
              {showSummon && (
                <div className="bg-slate-900/50 p-4 rounded-xl border border-teal-500/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">소환수 이름</label>
                    <TextInput
                      value={form.summon?.entityName || ''}
                      onChange={v => setForm({ ...form, summon: { ...(form.summon || { entityName: '', duration: 0, statInheritance: {} }), entityName: v } })}
                      placeholder="예: 테르밋 핑크"
                      className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">유지 시간 (초)</label>
                    <input
                      type="number"
                      value={form.summon?.duration || ''}
                      onChange={e => setForm({ ...form, summon: { ...(form.summon || { entityName: '', duration: 0, statInheritance: {} }), duration: Number(e.target.value) } })}
                      placeholder="예: 50 (무한은 -1)"
                      className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 grid grid-cols-3 gap-4 border-t border-slate-700/50 pt-3 mt-1">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">체력 계승</label>
                      <TextInput
                        value={form.summon?.statInheritance?.maxHP || ''}
                        onChange={v => setForm({ ...form, summon: { ...(form.summon || { entityName: '', duration: 0, statInheritance: {} }), statInheritance: { ...(form.summon?.statInheritance || {}), maxHP: v } } })}
                        placeholder="예: 119.5%"
                        className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">공격력 계승</label>
                      <TextInput
                        value={form.summon?.statInheritance?.atk || ''}
                        onChange={v => setForm({ ...form, summon: { ...(form.summon || { entityName: '', duration: 0, statInheritance: {} }), statInheritance: { ...(form.summon?.statInheritance || {}), atk: v } } })}
                        placeholder="예: 42.6%"
                        className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">치유력 계승</label>
                      <TextInput
                        value={form.summon?.statInheritance?.healingPower || ''}
                        onChange={v => setForm({ ...form, summon: { ...(form.summon || { entityName: '', duration: 0, statInheritance: {} }), statInheritance: { ...(form.summon?.statInheritance || {}), healingPower: v } } })}
                        placeholder="예: 100%"
                        className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">고유 스킬 정보</h3>
                <button onClick={addSkillSet} className="text-xs font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-3 py-1.5 rounded-lg border border-blue-500/30">
                  + 폼/스킬셋 추가
                </button>
              </div>

              {form.skills && form.skills.length > 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {form.skills.map((_, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => setActiveSkillIndex(idx)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeSkillIndex === idx ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      스킬셋 {idx + 1} {idx > 0 && <X size={14} className="inline-block ml-2 cursor-pointer hover:text-red-400" onClick={(e) => { e.stopPropagation(); removeSkillSet(idx); }} />}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkillInput typeLabel="EX 스킬" skill={(form.skills?.[activeSkillIndex]?.ex as Skill) || { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }} onChange={s => updateSkill(activeSkillIndex, 'ex', s)} showToast={showToast} />
                <SkillInput typeLabel="기본 스킬" skill={(form.skills?.[activeSkillIndex]?.normal as Skill) || { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }} onChange={s => updateSkill(activeSkillIndex, 'normal', s)} showToast={showToast} />
                <SkillInput typeLabel="강화 스킬" skill={(form.skills?.[activeSkillIndex]?.passive as Skill) || { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }} onChange={s => updateSkill(activeSkillIndex, 'passive', s)} showToast={showToast} />
                <SkillInput typeLabel="서브 스킬" skill={(form.skills?.[activeSkillIndex]?.sub as Skill) || { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }} onChange={s => updateSkill(activeSkillIndex, 'sub', s)} showToast={showToast} />
                {form.hasFavoriteItem && (
                  <SkillInput typeLabel="기본 스킬+" skill={(form.skills?.[activeSkillIndex]?.normalPlus as Skill) || { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }} onChange={s => updateSkill(activeSkillIndex, 'normalPlus', s)} showToast={showToast} hideName={true} />
                )}
                <SkillInput typeLabel="강화 스킬+" skill={(form.skills?.[activeSkillIndex]?.passivePlus as Skill) || { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }} onChange={s => updateSkill(activeSkillIndex, 'passivePlus', s)} showToast={showToast} hideName={true} />
              </div>
            </div>

            {isEtc && (
              <div>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">✨ ETC 커스텀 스킬 육성 재화</h3>
                <EtcSkillCostInput costs={form.etcSkillCosts} onChange={c => setForm({ ...form, etcSkillCosts: c })} schema={schema} />
              </div>
            )}

            <div>
              <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3">✨ 고유무기 한계해방 효과</h3>
              <div className="flex gap-6 items-start">
                <UniqueWeaponUpload url={form.uniqueWeaponUrl || ''} onChange={url => setForm({ ...form, uniqueWeaponUrl: url })} showToast={showToast} />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-purple-500/30">
                    <span className="text-xs font-black text-slate-300 bg-slate-700 px-2 py-1 rounded w-16 text-center flex-shrink-0">무기 이름</span>
                    <input value={(form.skills?.[activeSkillIndex]?.uniqueWeaponName) || (activeSkillIndex === 0 ? (form.uniqueWeaponName || '') : '')} onChange={e => {
                      const newSkills = [...(form.skills || [])];
                      if (!newSkills[activeSkillIndex]) newSkills[activeSkillIndex] = { ex: {} as any, normal: {} as any, passive: {} as any, sub: {} as any };
                      newSkills[activeSkillIndex] = {
                        ...newSkills[activeSkillIndex],
                        uniqueWeaponName: e.target.value
                      };
                      setForm({ ...form, skills: newSkills });
                    }}
                      placeholder="예: 아이언 호루스" className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors flex-1" />
                  </div>
                  {[{ key: 'star2', label: '★2 효과', desc: '강화 스킬+ 잠금 해제', color: 'border-blue-500/30' }, 
                    { key: 'star3', label: '★3 효과', desc: '지형 전투력 강화', color: 'border-emerald-500/30' }, 
                    { key: 'star4', label: '★4 효과', desc: '유효 보너스', color: 'border-amber-500/30' }].map(item => (
                    <div key={item.key} className={`flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border ${item.color}`}>
                      <span className="text-xs font-black text-slate-300 bg-slate-700 px-2 py-1 rounded w-16 text-center flex-shrink-0">{item.label}</span>
                      <input value={((form.skills?.[activeSkillIndex]?.uniqueWeaponEffects as any)?.[item.key]) || (activeSkillIndex === 0 ? ((form.uniqueWeaponEffects as any)?.[item.key] || '') : '')} onChange={e => {
                        const newSkills = [...(form.skills || [])];
                        if (!newSkills[activeSkillIndex]) newSkills[activeSkillIndex] = { ex: {} as any, normal: {} as any, passive: {} as any, sub: {} as any };
                        newSkills[activeSkillIndex] = {
                          ...newSkills[activeSkillIndex],
                          uniqueWeaponEffects: {
                            ...(newSkills[activeSkillIndex].uniqueWeaponEffects || (activeSkillIndex === 0 ? form.uniqueWeaponEffects : undefined) || { star2: '', star3: '', star4: '' }),
                            [item.key]: e.target.value
                          }
                        };
                        setForm({ ...form, skills: newSkills });
                      }}
                        placeholder={item.desc} className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors flex-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {form.hasFavoriteItem && (
              <div>
                <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3">🎁 애장품 효과</h3>
                <div className="flex gap-6 items-center">
                  <FavoriteItemUpload url={form.favoriteItemUrl || ''} onChange={url => setForm({ ...form, favoriteItemUrl: url })} showToast={showToast} />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 bg-pink-900/10 p-3 rounded-xl border border-pink-500/30">
                      <span className="text-xs font-black text-pink-300 bg-pink-900/50 px-2 py-1 rounded w-12 text-center flex-shrink-0">T1</span>
                      <input value={form.favoriteItemEffects?.t1 || ''} onChange={e => setForm({ ...form, favoriteItemEffects: { ...(form.favoriteItemEffects || { t1: '', t2: '' }), t1: e.target.value } })}
                        placeholder="예: 공격력 1300 증가" className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 transition-colors flex-1" />
                    </div>
                    <div className="flex items-center gap-3 bg-pink-900/10 p-3 rounded-xl border border-pink-500/30">
                      <span className="text-xs font-black text-pink-300 bg-pink-900/50 px-2 py-1 rounded w-12 text-center flex-shrink-0">T2</span>
                      <input value={form.favoriteItemEffects?.t2 || ''} onChange={e => setForm({ ...form, favoriteItemEffects: { ...(form.favoriteItemEffects || { t1: '', t2: '' }), t2: e.target.value } })}
                        placeholder="예: 기본 스킬이 기본 스킬+로 강화" className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 transition-colors flex-1" />
                    </div>
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>

        <div className="bg-slate-900 border-t border-slate-700 px-6 py-4 flex justify-end gap-3 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors">취소</button>
          <button onClick={() => { if (!form.name.trim()) return; onSave(form); }} disabled={!form.name.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"><Save size={16} /> {isNew ? '추가하기' : '수정하기'}</button>
        </div>
      </div>
    </div>
  );
}
