import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { SchemaConfig } from '../../types';
import type { StudentMaster, CustomSkillCostItem, EtcSkillCost } from '../../types';

interface EtcSkillCostInputProps {
  costs: StudentMaster['etcSkillCosts'];
  onChange: (costs: StudentMaster['etcSkillCosts']) => void;
  schema: SchemaConfig;
}

export function EtcSkillCostInput({ costs, onChange, schema }: EtcSkillCostInputProps) {
  const [exExpanded, setExExpanded] = useState(false);
  const [normalExpanded, setNormalExpanded] = useState(false);

  const schools = schema.enums.School?.values || [];
  const tiers = [
    { key: '0', label: '기초' },
    { key: '1', label: '일반' },
    { key: '2', label: '고급' },
    { key: '3', label: '최상급' }
  ];

  const updateCost = (
    skillType: 'ex' | 'normal',
    level: number,
    updater: (prev: EtcSkillCost) => EtcSkillCost
  ) => {
    const defaultCost: EtcSkillCost = { items: [], credit: 0 };
    const currentCosts = costs || { ex: {}, normal: {} };
    const currentSkillCosts = currentCosts[skillType] || {};
    const prevCost = currentSkillCosts[level] || defaultCost;
    
    onChange({
      ...currentCosts,
      [skillType]: {
        ...currentSkillCosts,
        [level]: updater(prevCost)
      }
    });
  };

  const addItem = (skillType: 'ex' | 'normal', level: number) => {
    updateCost(skillType, level, prev => ({
      ...prev,
      items: [...prev.items, { type: skillType === 'ex' ? 'BD' : 'Note', tier: 0, amount: 1 }]
    }));
  };

  const updateItem = (skillType: 'ex' | 'normal', level: number, index: number, field: keyof CustomSkillCostItem, value: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    updateCost(skillType, level, prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const removeItem = (skillType: 'ex' | 'normal', level: number, index: number) => {
    updateCost(skillType, level, prev => {
      const newItems = [...prev.items];
      newItems.splice(index, 1);
      return { ...prev, items: newItems };
    });
  };

  const updateCredit = (skillType: 'ex' | 'normal', level: number, credit: number) => {
    updateCost(skillType, level, prev => ({ ...prev, credit }));
  };

  const renderLevel = (skillType: 'ex' | 'normal', level: number) => {
    const currentCosts = costs || { ex: {}, normal: {} };
    const cost = currentCosts[skillType]?.[level] || { items: [], credit: 0 };

    return (
      <div key={`${skillType}-${level}`} className="mb-4 bg-slate-800/80 rounded-xl border border-slate-600 overflow-hidden">
        <div className="bg-slate-700/50 px-4 py-2 border-b border-slate-600 flex items-center justify-between">
          <span className="font-bold text-sm text-white">Lv.{level - 1} → Lv.{level}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">크레딧</span>
            <input 
              type="number" 
              value={cost.credit || ''} 
              onChange={e => updateCredit(skillType, level, Number(e.target.value))}
              placeholder="0"
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white w-24 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="p-3 space-y-2">
          {cost.items.map((item, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              {skillType === 'ex' ? (
                <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-300 font-medium">전술 교육 BD</div>
              ) : (
                <select
                  value={item.type}
                  onChange={e => updateItem(skillType, level, idx, 'type', e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Note">기술 노트</option>
                  <option value="Secret">비의서</option>
                </select>
              )}

              {item.type !== 'Secret' && (
                <>
                  <select
                    value={item.school || ''}
                    onChange={e => updateItem(skillType, level, idx, 'school', e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">학원 선택</option>
                    {schools.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>

                  <select
                    value={item.tier ?? 0}
                    onChange={e => updateItem(skillType, level, idx, 'tier', Number(e.target.value))}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 w-20"
                  >
                    {tiers.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </>
              )}

              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 mx-1">x</span>
                <input 
                  type="number" 
                  value={item.amount || ''} 
                  onChange={e => updateItem(skillType, level, idx, 'amount', Number(e.target.value))}
                  min={1}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white w-16 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button 
                onClick={() => removeItem(skillType, level, idx)}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors ml-auto"
                title="삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          
          <button 
            onClick={() => addItem(skillType, level)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium py-1 px-2 hover:bg-blue-900/30 rounded transition-colors"
          >
            <Plus size={14} /> 아이템 추가
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* EX Skill */}
      <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800/30">
        <button 
          className="w-full px-4 py-3 bg-slate-800 flex items-center justify-between hover:bg-slate-700 transition-colors"
          onClick={() => setExExpanded(!exExpanded)}
        >
          <span className="font-bold text-sm text-amber-400">EX 스킬 재화 (Lv.2 ~ Lv.5)</span>
          {exExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {exExpanded && (
          <div className="p-4 bg-slate-900/50">
            {[2, 3, 4, 5].map(level => renderLevel('ex', level))}
          </div>
        )}
      </div>

      {/* Normal Skill */}
      <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800/30">
        <button 
          className="w-full px-4 py-3 bg-slate-800 flex items-center justify-between hover:bg-slate-700 transition-colors"
          onClick={() => setNormalExpanded(!normalExpanded)}
        >
          <span className="font-bold text-sm text-blue-400">일반/강화/서브 스킬 재화 (Lv.2 ~ Lv.10)</span>
          {normalExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {normalExpanded && (
          <div className="p-4 bg-slate-900/50">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => renderLevel('normal', level))}
          </div>
        )}
      </div>
    </div>
  );
}
