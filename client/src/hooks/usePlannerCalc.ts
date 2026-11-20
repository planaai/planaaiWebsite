import { useState } from 'react';
import { api } from '@/lib/api';
import type { StudentMaster, SchemaConfig } from '@/types';
import { toast } from 'sonner';

export function usePlannerCalc(
  masterData: StudentMaster[],
  schema: SchemaConfig | null,
  plans: any[] // We can type this as PlannerRecord[] when imported
) {
  const [calcResult, setCalcResult] = useState<any>(null);
  const [combinedResult, setCombinedResult] = useState<any>(null);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  const enrichRequirements = (req: any, student: StudentMaster | undefined) => {
    const enriched = {
      credits: req.credits,
      expReports: {} as Record<string, any>,
      blueprints: {} as Record<string, any>,
      elephs: req.elephs,
      weaponExp: req.weaponExp,
      weaponItems: {} as Record<string, any>,
      ooparts: {} as Record<string, any>,
      wbs: {} as Record<string, any>,
      bds: {} as Record<string, any>,
      techNotes: {} as Record<string, any>,
      secret: req.secret || 0
    };

    const getTierIdx = (name: string) => {
      if (name.includes('최상급') || name.startsWith('4')) return 3;
      if (name.includes('상급') || name.startsWith('3')) return 2;
      if (name.includes('일반') || name.startsWith('2')) return 1;
      return 0; // 기초, 1
    };

    // expReports
    for (const [key, amount] of Object.entries(req.expReports || {})) {
      if ((amount as number) > 0) {
        let iconUrl = '';
        if (schema?.resourceIcons?.ExpReports) {
          const tierIdx = ['초급 활동 보고서', '일반 활동 보고서', '상급 활동 보고서', '최상급 활동 보고서'].indexOf(key);
          if (tierIdx !== -1) iconUrl = schema.resourceIcons.ExpReports[tierIdx] || '';
        }
        enriched.expReports[key] = { amount, name: key, iconUrl };
      }
    }

    // weaponItems
    for (const [key, amount] of Object.entries(req.weaponItems || {})) {
      if ((amount as number) > 0) {
        let iconUrl = '';
        if (schema?.resourceIcons?.WeaponParts) {
            if (key.includes('스프링')) iconUrl = schema.resourceIcons.WeaponParts.Spring[2] || '';
            else if (key.includes('해머')) iconUrl = schema.resourceIcons.WeaponParts.Hammer[2] || '';
            else if (key.includes('총열')) iconUrl = schema.resourceIcons.WeaponParts.Barrel[2] || '';
            else if (key.includes('공이')) iconUrl = schema.resourceIcons.WeaponParts.FiringPin[2] || '';
        }
        enriched.weaponItems[key] = { amount, name: key, iconUrl };
      }
    }

    for (const [key, val] of Object.entries(req.blueprints || {})) {
       if (typeof val === 'object' && val !== null) {
           const tier = (val as any).tier;
           const type = (val as any).type;
           const equipLabel = schema?.equipments?.find(e => e.key === type)?.label || type;
           const name = tier && type ? `T${tier} ${equipLabel} 설계도면` : key;
           enriched.blueprints[key] = { amount: (val as any).amount, name, iconUrl: (val as any).iconUrl || '', tier, type };
       } else {
           enriched.blueprints[key] = { amount: val as number, name: key, iconUrl: '' };
       }
    }

    // wbs
    for (const [key, amount] of Object.entries(req.wbs || {})) {
       let iconUrl = '';
       if (schema?.resourceIcons?.WBs?.[key]) {
         iconUrl = schema.resourceIcons.WBs[key];
       }
       enriched.wbs[key] = { amount, name: key, iconUrl };
    }

    // ooparts
    for (const [key, amount] of Object.entries(req.ooparts || {})) {
      if ((amount as number) <= 0) continue;
      const isMain = key.includes('(메인)');
      const tierIdx = getTierIdx(key);
      const oopartKey = isMain ? student?.primaryOopart : student?.secondaryOopart;
      
      let specificName = key;
      let iconUrl = '';
      
      if (oopartKey && schema?.ooparts) {
        const def = schema.ooparts.find(o => o.key === oopartKey);
        if (def && def.tiers[tierIdx]) {
          specificName = def.tiers[tierIdx].name;
          iconUrl = def.tiers[tierIdx].iconUrl;
        }
      }
      
      if (!enriched.ooparts[specificName]) {
        enriched.ooparts[specificName] = { amount, name: specificName, iconUrl };
      } else {
        enriched.ooparts[specificName].amount += amount;
      }
    }

    // bds
    for (const [key, amount] of Object.entries(req.bds || {})) {
      if ((amount as number) <= 0) continue;
      const tierIdx = getTierIdx(key);
      const school = student?.school;
      
      let specificName = key;
      let iconUrl = '';
      
      if (school) {
        const schoolLabel = schema?.enums?.School?.values.find(v => v.key === school)?.label || school;
        const prefix = ['기초', '일반', '상급', '최상급'][tierIdx];
        specificName = `${prefix} 전술 교육 BD (${schoolLabel})`;
        if (schema?.resourceIcons?.BDs?.[school]?.[tierIdx]) {
          iconUrl = schema.resourceIcons.BDs[school][tierIdx];
        }
      }
      
      enriched.bds[specificName] = { amount, name: specificName, iconUrl };
    }

    // techNotes
    for (const [key, amount] of Object.entries(req.techNotes || {})) {
      if ((amount as number) <= 0) continue;
      const tierIdx = getTierIdx(key);
      const school = student?.school;
      
      let specificName = key;
      let iconUrl = '';
      
      if (school) {
        const schoolLabel = schema?.enums?.School?.values.find(v => v.key === school)?.label || school;
        const prefix = ['기초', '일반', '상급', '최상급'][tierIdx];
        specificName = `${prefix} 기술 노트 (${schoolLabel})`;
        if (schema?.resourceIcons?.TechNotes?.[school]?.[tierIdx]) {
          iconUrl = schema.resourceIcons.TechNotes[school][tierIdx];
        }
      }
      
      enriched.techNotes[specificName] = { amount, name: specificName, iconUrl };
    }

    return enriched;
  };

  const handleCalculate = async (plan: any) => {
    try {
      const student = masterData.find(m => m.id === plan.studentId);
      const res = await api.post(`/planner/calculate/dynamic`, { 
        plan: { 
          ...plan, 
          weaponType: student?.weaponType,
          equip1Type: student?.equipmentSlot1,
          equip2Type: student?.equipmentSlot2,
          equip3Type: student?.equipmentSlot3
        } 
      });
      setCalcResult({ plan: { ...plan, student }, required: enrichRequirements(res.data.required, student) });
      setCombinedResult(null);
      setEditingPlan(null);
    } catch (e: unknown) {
      toast.error('잠시 후에 다시 시도해 주세요');
    }
  };

  const handleCalculateCombined = async () => {
    setCombinedResult(null);
    setCalcResult(null);
    setEditingPlan(null);
    try {
      const total = {
        credits: 0,
        expReports: {} as Record<string, any>,
        blueprints: {} as Record<string, any>,
        elephs: 0,
        weaponExp: 0,
        weaponItems: {} as Record<string, any>,
        ooparts: {} as Record<string, any>,
        wbs: {} as Record<string, any>,
        bds: {} as Record<string, any>,
        techNotes: {} as Record<string, any>,
        secret: 0
      };
      
      const mergeRecord = (target: Record<string, any>, source: Record<string, any> = {}) => {
        for (const [key, item] of Object.entries(source)) {
          if (!target[key]) target[key] = { ...item };
          else target[key].amount += item.amount;
        }
      };

      for (const p of plans) {
        const student = masterData.find(m => m.id === p.studentId);
        const res = await api.post(`/planner/calculate/dynamic`, { 
          plan: { 
            ...p, 
            weaponType: student?.weaponType,
            equip1Type: student?.equipmentSlot1,
            equip2Type: student?.equipmentSlot2,
            equip3Type: student?.equipmentSlot3
          } 
        });
        const req = enrichRequirements(res.data.required, student);

        total.credits += req.credits;
        mergeRecord(total.expReports, req.expReports);
        mergeRecord(total.blueprints, req.blueprints);
        total.elephs += req.elephs;
        total.weaponExp += req.weaponExp;
        mergeRecord(total.weaponItems, req.weaponItems);
        total.secret += req.secret;
        mergeRecord(total.ooparts, req.ooparts);
        mergeRecord(total.wbs, req.wbs);
        mergeRecord(total.bds, req.bds);
        mergeRecord(total.techNotes, req.techNotes);
      }
      setCombinedResult(total);
    } catch (e: unknown) {
      toast.error('잠시 후에 다시 시도해 주세요');
    }
  };

  return {
    calcResult,
    setCalcResult,
    combinedResult,
    setCombinedResult,
    editingPlan,
    setEditingPlan,
    handleCalculate,
    handleCalculateCombined
  };
}
