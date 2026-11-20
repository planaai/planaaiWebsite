import { useState, useMemo } from 'react';
import { X, Save, Star, Sparkles, Gift as GiftIcon, Search } from 'lucide-react';
import type { StudentMaster, SchemaConfig, Skill, StudentPreferredGifts, Gift } from '../../types';
import { API } from '../../constants';
import { PortraitUpload, IllustUpload, SkillInput, Select, FavoriteItemUpload, TextInput, ComboBox } from '../ui';
import { EtcSkillCostInput } from './EtcSkillCostInput';
import { MasterJsonImportModal, mergeUrlArrays, preserveUrl, mergeSkill, mergeSkillField, normalizePreferredGifts } from './MasterJsonImportModal';

interface MasterModalProps {
  student: Omit<StudentMaster, 'id'> & { id?: number };
  isNew: boolean;
  schema: SchemaConfig;
  onSave: (data: Omit<StudentMaster, 'id'> & { id?: number }) => void;
  onClose: () => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}

export function MasterModal({ student, isNew, schema, onSave, onClose, showToast }: MasterModalProps) {
  const [form, setForm] = useState(student);
  const [showSummon, setShowSummon] = useState(!!student.summon);
  const [showJsonModal, setShowJsonModal] = useState(false);
  
  const [activeSkillIndex, setActiveSkillIndex] = useState(0);

  const initialGifts = useMemo<StudentPreferredGifts>(() => {
    if (student.preferredGifts) {
      return normalizePreferredGifts(student.preferredGifts);
    }
    const gifts = schema.gifts || [];
    const sId = Number(student.id);
    if (!isNew && !isNaN(sId) && sId > 0) {
      const matchStudent = (arr?: (number | string)[]) => (arr || []).some(id => Number(id) === sId);
      return normalizePreferredGifts({
        level4: gifts.filter(g => g && g.key && matchStudent(g.affinity?.level4)).map(g => String(g.key)),
        level3: gifts.filter(g => g && g.key && matchStudent(g.affinity?.level3)).map(g => String(g.key)),
        level2: gifts.filter(g => g && g.key && matchStudent(g.affinity?.level2)).map(g => String(g.key)),
      });
    }
    return { level2: [], level3: [], level4: [] };
  }, [student, schema.gifts, isNew]);

  const [preferredGifts, setPreferredGifts] = useState<StudentPreferredGifts>(initialGifts);
  const [giftSearchTerm, setGiftSearchTerm] = useState('');
  const [giftTierFilter, setGiftTierFilter] = useState<'ALL' | 'Normal' | 'HighGrade'>('ALL');

  const giftMap = useMemo(() => {
    const map = new Map<string, Gift>();
    (schema.gifts || []).forEach(g => {
      if (!g || !g.key) return;
      map.set(g.key, g);
      map.set(g.key.toLowerCase().trim(), g);
    });
    return map;
  }, [schema.gifts]);

  const filteredGifts = useMemo(() => {
    const list = schema.gifts || [];
    return list.filter(g => {
      if (!g || !g.key) return false;
      if (giftTierFilter !== 'ALL' && g.tier !== giftTierFilter) {
        return false;
      }
      if (giftSearchTerm.trim()) {
        const q = giftSearchTerm.toLowerCase().trim();
        const matchName = (typeof g.name === 'string' ? g.name : '').toLowerCase().includes(q);
        const matchKey = String(g.key || '').toLowerCase().includes(q);
        if (!matchName && !matchKey) return false;
      }
      return true;
    });
  }, [schema.gifts, giftTierFilter, giftSearchTerm]);

  const toggleGiftAffinity = (giftKey: string, level: 'level2' | 'level3' | 'level4') => {
    if (!giftKey || typeof giftKey !== 'string') return;
    const target = giftKey.toLowerCase().trim();
    if (!target) return;
    setPreferredGifts(prev => {
      const currentList = prev[level] || [];
      const isCurrentlyInLevel = currentList.some(k => typeof k === 'string' && k.toLowerCase().trim() === target);
      const nextLevel2 = (prev.level2 || []).filter(k => typeof k === 'string' && k.toLowerCase().trim() !== target);
      const nextLevel3 = (prev.level3 || []).filter(k => typeof k === 'string' && k.toLowerCase().trim() !== target);
      const nextLevel4 = (prev.level4 || []).filter(k => typeof k === 'string' && k.toLowerCase().trim() !== target);

      if (isCurrentlyInLevel) {
        return {
          level2: nextLevel2,
          level3: nextLevel3,
          level4: nextLevel4
        };
      } else {
        const canonicalKey = (schema.gifts || []).find(g => g && g.key && g.key.toLowerCase().trim() === target)?.key || giftKey;
        if (level === 'level2') nextLevel2.push(canonicalKey);
        if (level === 'level3') nextLevel3.push(canonicalKey);
        if (level === 'level4') nextLevel4.push(canonicalKey);
        return {
          level2: nextLevel2,
          level3: nextLevel3,
          level4: nextLevel4
        };
      }
    });
  };

  const removeGiftAffinity = (giftKey: string) => {
    if (!giftKey || typeof giftKey !== 'string') return;
    const target = giftKey.toLowerCase().trim();
    if (!target) return;
    setPreferredGifts(prev => ({
      level2: (prev.level2 || []).filter(k => typeof k === 'string' && k.toLowerCase().trim() !== target),
      level3: (prev.level3 || []).filter(k => typeof k === 'string' && k.toLowerCase().trim() !== target),
      level4: (prev.level4 || []).filter(k => typeof k === 'string' && k.toLowerCase().trim() !== target)
    }));
  };

  const getGiftIconSrc = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    return `${API}${url.startsWith('/') ? '' : '/'}${url}`;
  };

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

  const isShunSwimsuit = form.name.replace(/\s+/g, '') === '슌(수영복)';

  const updatePortrait = (url: string) => {
    setForm(prev => {
      const urls = [...(prev.portraitUrls || [])];
      urls[0] = url;
      return { ...prev, portraitUrls: urls };
    });
  };

  const updatePortraitIco = (index: number, url: string) => {
    setForm(prev => {
      const icos = [...(prev.portraitIco || ['', ''])];
      icos[index] = url;
      return { ...prev, portraitIco: icos };
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
      {showJsonModal && (
        <MasterJsonImportModal
          isOpen={showJsonModal}
          onClose={() => setShowJsonModal(false)}
          currentStudent={{ ...form, preferredGifts }}
          onImport={(imported) => {
            setForm(prev => {
              const portraitUrls = mergeUrlArrays(imported.portraitUrls, prev.portraitUrls);
              const portraitIco = mergeUrlArrays(imported.portraitIco, prev.portraitIco);
              const favoriteItemUrl = preserveUrl(imported.favoriteItemUrl, prev.favoriteItemUrl);
              const skills = (imported.skills || []).map((sSet, sIdx) => {
                const prevSet = prev.skills?.[sIdx];
                return {
                  ...sSet,
                  portraitUrl: preserveUrl(sSet.portraitUrl, prevSet?.portraitUrl),
                  fullIllustUrl: preserveUrl(sSet.fullIllustUrl, prevSet?.fullIllustUrl),
                  ex: mergeSkillField(sSet.ex, prevSet?.ex),
                  normal: mergeSkillField(sSet.normal, prevSet?.normal),
                  passive: mergeSkill(sSet.passive, prevSet?.passive),
                  sub: mergeSkill(sSet.sub, prevSet?.sub),
                  normalPlus: mergeSkill(sSet.normalPlus, prevSet?.normalPlus),
                  passivePlus: mergeSkill(sSet.passivePlus, prevSet?.passivePlus),
                };
              });

              return {
                ...imported,
                id: isNew ? undefined : prev.id,
                portraitUrls,
                ...(portraitIco.length > 0 ? { portraitIco } : {}),
                favoriteItemUrl,
                skills
              };
            });
            if (imported.preferredGifts) {
              setPreferredGifts(normalizePreferredGifts(imported.preferredGifts));
            }
            setShowJsonModal(false);
            showToast(`'${imported.name || '학생'}' 데이터를 폼에 적용했습니다. (기존 이미지 URL 보존 완료)`);
          }}
          schema={schema}
          showToast={showToast}
        />
      )}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h2 className="text-xl font-bold text-white">{isNew ? '신규 마스터 데이터 추가' : `✏️ ${form.name} 마스터 수정`}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowJsonModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 hover:text-white px-3 py-1.5 rounded-lg border border-indigo-500/40 transition-colors shadow-sm"
              title="변환기에서 생성된 JSON 데이터를 붙여넣거나 파일로 불러와 입력 폼을 자동으로 채웁니다."
            >
              <Sparkles size={14} /> JSON 불러오기
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
          </div>
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

                    {isShunSwimsuit && (
                      <div className="w-full">
                        <label className="text-xs font-semibold text-pink-400 uppercase tracking-wider mb-2 block">폼 전환 아이콘 (portraitIco)</label>
                        <div className="flex flex-col gap-2">
                          {[0, 1].map((icoIdx) => (
                            <div key={icoIdx} className="w-full flex flex-col border border-pink-500/30 p-2 rounded-lg bg-slate-800/30">
                              <span className="text-[10px] text-pink-300 font-bold mb-1.5">
                                portraitIco[{icoIdx}] ({icoIdx === 0 ? '성숙한 버전' : '어린 버전'})
                              </span>
                              <div className="flex justify-center w-full">
                                <PortraitUpload
                                  url={form.portraitIco?.[icoIdx] || ''}
                                  onChange={newUrl => updatePortraitIco(icoIdx, newUrl)}
                                  showToast={showToast}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                        setForm({ ...form, summon: { entityName: '' } });
                      }
                    }}
                    className="w-4 h-4 text-teal-500 bg-slate-700 border-slate-500 rounded focus:ring-teal-500"
                  />
                </label>
              </div>
              {showSummon && (
                <div className="bg-slate-900/50 p-4 rounded-xl border border-teal-500/30">
                  <div className="flex flex-col gap-1.5 max-w-sm mb-4">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">소환수 이름</label>
                    <TextInput
                      value={form.summon?.entityName || ''}
                      onChange={v => setForm({ ...form, summon: { ...(form.summon || { entityName: '' }), entityName: v } })}
                      placeholder="예: 테르밋 핑크"
                      className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 mt-2 pt-4 border-t border-teal-500/30">
                    <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-3">소환수 전용 스킬</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SkillInput typeLabel="기본 스킬 (소환수)" skill={(form.summon?.skills?.normal as Skill) || { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }} onChange={s => setForm({ ...form, summon: { ...form.summon!, skills: { ...(form.summon?.skills || {}), normal: s } } })} showToast={showToast} />
                      <SkillInput typeLabel="강화 스킬 (소환수)" skill={(form.summon?.skills?.passive as Skill) || { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }} onChange={s => setForm({ ...form, summon: { ...form.summon!, skills: { ...(form.summon?.skills || {}), passive: s } } })} showToast={showToast} />
                      <SkillInput typeLabel="서브 스킬 (소환수)" skill={(form.summon?.skills?.sub as Skill) || { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }} onChange={s => setForm({ ...form, summon: { ...form.summon!, skills: { ...(form.summon?.skills || {}), sub: s } } })} showToast={showToast} />
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
              <div className="space-y-3">
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

            {/* 🎁 선호 선물 설정 섹션 */}
            <div className="border-t border-slate-700/60 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2">
                    <GiftIcon size={16} /> 선호 선물 설정 (호감도 아이템)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    학생이 선호하는 선물을 지정하면 선물 DB(호감도 매핑)에 실시간 자동 동기화됩니다.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold self-start sm:self-auto">
                  <span className="px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    Lv.4 {(preferredGifts.level4 || []).length}개
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Lv.3 {(preferredGifts.level3 || []).length}개
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Lv.2 {(preferredGifts.level2 || []).length}개
                  </span>
                </div>
              </div>

              {/* 현재 선택된 선호 선물 요약 영역 */}
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/60 p-4 space-y-3 mb-4">
                {/* Lv.4 Row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-1.5 w-32 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.8)]" />
                    <span className="text-xs font-bold text-pink-300">매우 선호 (Lv.4)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-1 min-h-[30px] items-center">
                    {(preferredGifts.level4 || []).length === 0 ? (
                      <span className="text-xs text-slate-500 italic">선택된 선물 없음</span>
                    ) : (
                      (preferredGifts.level4 || []).map(key => {
                        const k = typeof key === 'string' ? key.toLowerCase().trim() : '';
                        const gift = giftMap.get(key) || (k ? giftMap.get(k) : undefined);
                        return (
                          <span
                            key={key}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-950/40 border border-pink-500/40 text-pink-200 text-xs shadow-sm hover:border-pink-400 transition-colors"
                          >
                            {gift?.iconUrl ? (
                              <img src={getGiftIconSrc(gift.iconUrl)} alt="" className="w-4 h-4 object-contain rounded" />
                            ) : null}
                            <span className="font-medium">{gift?.name || key}</span>
                            <button
                              type="button"
                              onClick={() => removeGiftAffinity(key)}
                              className="text-pink-400 hover:text-white ml-0.5 rounded p-0.5 hover:bg-pink-800/50 transition-colors cursor-pointer"
                              title="선호 해제"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Lv.3 Row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-700/40">
                  <div className="flex items-center gap-1.5 w-32 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                    <span className="text-xs font-bold text-blue-300">선호 (Lv.3)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-1 min-h-[30px] items-center">
                    {(preferredGifts.level3 || []).length === 0 ? (
                      <span className="text-xs text-slate-500 italic">선택된 선물 없음</span>
                    ) : (
                      (preferredGifts.level3 || []).map(key => {
                        const k = typeof key === 'string' ? key.toLowerCase().trim() : '';
                        const gift = giftMap.get(key) || (k ? giftMap.get(k) : undefined);
                        return (
                          <span
                            key={key}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-500/40 text-blue-200 text-xs shadow-sm hover:border-blue-400 transition-colors"
                          >
                            {gift?.iconUrl ? (
                              <img src={getGiftIconSrc(gift.iconUrl)} alt="" className="w-4 h-4 object-contain rounded" />
                            ) : null}
                            <span className="font-medium">{gift?.name || key}</span>
                            <button
                              type="button"
                              onClick={() => removeGiftAffinity(key)}
                              className="text-blue-400 hover:text-white ml-0.5 rounded p-0.5 hover:bg-blue-800/50 transition-colors cursor-pointer"
                              title="선호 해제"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Lv.2 Row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-700/40">
                  <div className="flex items-center gap-1.5 w-32 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <span className="text-xs font-bold text-emerald-300">일반 선호 (Lv.2)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-1 min-h-[30px] items-center">
                    {(preferredGifts.level2 || []).length === 0 ? (
                      <span className="text-xs text-slate-500 italic">선택된 선물 없음</span>
                    ) : (
                      (preferredGifts.level2 || []).map(key => {
                        const k = typeof key === 'string' ? key.toLowerCase().trim() : '';
                        const gift = giftMap.get(key) || (k ? giftMap.get(k) : undefined);
                        return (
                          <span
                            key={key}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs shadow-sm hover:border-emerald-400 transition-colors"
                          >
                            {gift?.iconUrl ? (
                              <img src={getGiftIconSrc(gift.iconUrl)} alt="" className="w-4 h-4 object-contain rounded" />
                            ) : null}
                            <span className="font-medium">{gift?.name || key}</span>
                            <button
                              type="button"
                              onClick={() => removeGiftAffinity(key)}
                              className="text-emerald-400 hover:text-white ml-0.5 rounded p-0.5 hover:bg-emerald-800/50 transition-colors cursor-pointer"
                              title="선호 해제"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* 검색 및 등급 필터 */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="선물 이름 또는 ID 검색..."
                    value={giftSearchTerm}
                    onChange={e => setGiftSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {(['ALL', 'Normal', 'HighGrade'] as const).map(tier => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setGiftTierFilter(tier)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                        giftTierFilter === tier
                          ? 'bg-pink-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {tier === 'ALL' ? '전체 등급' : tier === 'Normal' ? '일반' : '고급'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 선물 목록 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1 border border-slate-700/60 rounded-xl p-2.5 bg-slate-900/60 scrollbar-thin scrollbar-thumb-slate-700">
                {filteredGifts.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-xs text-slate-500">
                    등록된 선물이 없거나 검색 결과가 없습니다.
                  </div>
                ) : (
                  filteredGifts.map(gift => {
                    const giftKeyLower = String(gift.key || '').toLowerCase().trim();
                    const isLv2 = (preferredGifts.level2 || []).some(k => typeof k === 'string' && k.toLowerCase().trim() === giftKeyLower);
                    const isLv3 = (preferredGifts.level3 || []).some(k => typeof k === 'string' && k.toLowerCase().trim() === giftKeyLower);
                    const isLv4 = (preferredGifts.level4 || []).some(k => typeof k === 'string' && k.toLowerCase().trim() === giftKeyLower);

                    return (
                      <div
                        key={gift.key}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                          isLv4
                            ? 'bg-pink-950/30 border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.15)]'
                            : isLv3
                            ? 'bg-blue-950/30 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                            : isLv2
                            ? 'bg-emerald-950/30 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                            : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                          <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden relative">
                            {gift.iconUrl ? (
                              <img src={getGiftIconSrc(gift.iconUrl)} alt={gift.name || ''} className="w-8 h-8 object-contain" />
                            ) : (
                              <GiftIcon size={18} className="text-slate-600" />
                            )}
                            <span className="absolute bottom-0 right-0 text-[8px] font-bold px-1 rounded-tl bg-slate-800/90 text-slate-300">
                              {gift.tier === 'Normal' ? '일반' : '고급'}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">{gift.name || gift.key}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">{gift.key}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleGiftAffinity(gift.key, 'level2')}
                            className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                              isLv2
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                            title="일반 선호 (Lv.2) 토글"
                          >
                            Lv.2
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleGiftAffinity(gift.key, 'level3')}
                            className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                              isLv3
                                ? 'bg-blue-500 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                            title="선호 (Lv.3) 토글"
                          >
                            Lv.3
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleGiftAffinity(gift.key, 'level4')}
                            className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                              isLv4
                                ? 'bg-pink-500 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                            title="매우 선호 (Lv.4) 토글"
                          >
                            Lv.4
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border-t border-slate-700 px-6 py-4 flex justify-end gap-3 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors">취소</button>
          <button onClick={() => { if (!form.name.trim()) return; onSave({ ...form, preferredGifts: normalizePreferredGifts(preferredGifts) }); }} disabled={!form.name.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors cursor-pointer"><Save size={16} /> {isNew ? '추가하기' : '수정하기'}</button>
        </div>
      </div>
    </div>
  );
}
