import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { X } from 'lucide-react';
import { SchemaConfig } from '@/types';
import { getImageUrl } from './utils';

interface PlannerCalcResultProps {
  data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  title: string;
  isCombined?: boolean;
  schema: SchemaConfig | null;
  onClose: () => void;
}

export function PlannerCalcResult({ data, title, isCombined = false, schema, onClose }: PlannerCalcResultProps) {
  const [dropData, setDropData] = useState<any[]>([]);

  useEffect(() => {
    api.get('/planner/equipment-drops')
      .then(res => setDropData(res.data))
      .catch(console.error);
  }, []);

  if (!data) return null;

  const getEquipmentIcon = (type: string, tier: number) => {
     if (!schema?.equipments) return '';
     const equipData = schema.equipments.find(e => e.key === type);
     if (!equipData || !equipData.tiers || !equipData.tiers[tier - 1]) return '';
     const tData = equipData.tiers[tier - 1];
     return tData.blueprintIconUrl || tData.iconUrl || '';
  };

  const getEquipmentLabel = (type: string) => {
     if (!schema?.equipments) return type;
     return schema.equipments.find(e => e.key === type)?.label || type;
  };

  const getRecommendedStages = () => {
    if (!data.blueprints || Object.keys(data.blueprints).length === 0 || dropData.length === 0) return { routes: [], totalAP: 0 };
    
    // 1. 필요한 장비 목록 추출 및 복사
    let requirements = Object.entries(data.blueprints).map(([name, val]) => {
       const v = val as any;
       const tier = v.tier || 0;
       const type = v.type || '';
       return { name, tier, type, amount: v.amount };
    }).filter(req => req.amount > 0 && req.tier > 0 && req.type !== '');
    
    if (requirements.length === 0) return { routes: [], totalAP: 0 };

    const results: any[] = [];
    
    // 2. 티어(Tier) 기준 내림차순 정렬 (고티어부터 우선 파밍)
    requirements.sort((a, b) => b.tier - a.tier);

    let maxIterations = 50; // 무한루프 방지
    let totalAP = 0;

    // 3. 시뮬레이션 시작
    while (requirements.length > 0 && maxIterations > 0) {
       maxIterations--;
       
       // 현재 남은 요구량 중 가장 우선순위가 높은 타겟 (고티어, 리스트 첫번째)
       const target = requirements[0];
       
       let bestStage: any = null;
       let bestScore = -1;
       let bestTargetDropRate = 0;
       
       // 전체 스테이지 중 타겟 아이템을 드랍하면서 '잔여 필요 장비들'을 가장 많이 주는 곳 탐색
       for (const stage of dropData) {
           const targetDrop = stage.drops.find((d: any) => d.tier === target.tier && d.type === target.type);
           if (!targetDrop) continue;
           
           let score = 0;
           for (const drop of stage.drops) {
               const req = requirements.find(r => r.tier === drop.tier && r.type === drop.type);
               if (req) {
                   // 임시 스코어: 잔여 요구량에 비례하여 높은 점수 부여 (병목 완화)
                   score += (drop.rate / 100) * req.amount;
               }
           }
           
           if (score > bestScore) {
               bestScore = score;
               bestStage = stage;
               bestTargetDropRate = targetDrop.rate;
           }
       }
       
       if (!bestStage || bestTargetDropRate === 0) {
           // 드랍처를 찾지 못한 경우 목록에서 제거하고 진행
           requirements.shift();
           continue;
       }
       
       // 타겟을 모두 획득하기 위해 필요한 반복 횟수 계산
       const expectedPerRun = bestTargetDropRate / 100;
       const runsNeeded = Math.ceil(target.amount / expectedPerRun);
       
       const farmedItems: any[] = [];
       
       // 해당 스테이지를 runsNeeded 만큼 돌았을 때 획득하는 아이템들을 모든 잔여 요구량에서 차감
       for (const drop of bestStage.drops) {
           const reqIndex = requirements.findIndex(r => r.tier === drop.tier && r.type === drop.type);
           if (reqIndex !== -1) {
               const farmedAmount = runsNeeded * (drop.rate / 100);
               requirements[reqIndex].amount -= farmedAmount;
               
               farmedItems.push({
                   type: drop.type,
                   tier: drop.tier,
                   amount: Math.round(farmedAmount) // 반올림하여 표기용으로 사용
               });
           }
       }
       
       const cost = runsNeeded * 10;
       totalAP += cost;
       
       // 시뮬레이션 결과에 추가 (동일 스테이지 누적 방지: 새로운 항목으로 추가해도 무방함)
       results.push({
           stage: bestStage.stage,
           runs: runsNeeded,
           expectedCost: cost,
           farmed: farmedItems
       });
       
       // 필요량이 0 이하가 된 장비 제거
       requirements = requirements.filter(req => req.amount > 0);
    }
    
    return { routes: results, totalAP };
  };

  const { routes: farmingRoutes, totalAP } = getRecommendedStages();

  const renderItem = (item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
    <div key={item.name} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between hover:border-[var(--plana-primary)] transition-colors shadow-sm">
      <div className="flex items-center gap-2.5 overflow-hidden flex-1">
        {item.iconUrl ? (
          <img src={getImageUrl(item.iconUrl)} className="w-8 h-8 object-contain shrink-0 drop-shadow-sm" alt="" />
        ) : (
          <div className="w-8 h-8 shrink-0 bg-slate-100 rounded-md flex items-center justify-center text-[8px] text-slate-400 border border-slate-200">Img</div>
        )}
        <span className="text-slate-700 truncate font-bold text-sm" title={item.name}>{item.name}</span>
      </div>
      <span className="text-slate-600 font-black shrink-0 ml-2 text-sm tabular-nums">x{item.amount}</span>
    </div>
  );

  return (
    <div className={`rounded-xl border h-full flex flex-col overflow-hidden ${isCombined ? 'bg-slate-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className={`flex justify-between items-center p-4 shrink-0 border-b z-10 backdrop-blur-md ${isCombined ? 'bg-emerald-50/90 border-emerald-100' : 'bg-white/90 border-slate-100'}`}>
        <h3 className={`text-lg font-bold flex items-center gap-2 ${isCombined ? 'text-emerald-600' : 'text-[var(--plana-primary)]'}`}>
          {title}
        </h3>
        <button onClick={onClose} className="p-1.5 bg-white/50 text-slate-400 hover:text-[var(--plana-primary)] hover:bg-pink-50 rounded-lg transition-colors">
          <X size={20}/>
        </button>
      </div>
      
      <div className={`flex-1 overflow-y-auto py-5 px-6 sm:px-8 space-y-6 ${isCombined ? 'custom-scrollbar-emerald' : 'custom-scrollbar'}`}>
        <div className="bg-slate-50 border border-slate-200 p-4 shadow-sm -skew-x-[10deg] rounded-lg flex justify-between items-center">
          <div className="skew-x-[10deg] flex justify-between items-center w-full px-2">
            <span className="text-sm font-bold text-slate-600 tracking-wider">필요 크레딧</span>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-500 text-2xl font-black tabular-nums">{data.credits.toLocaleString()}</span>
              {schema?.resourceIcons?.Credit ? (
                <img src={getImageUrl(schema.resourceIcons.Credit)} alt="C" className="w-10 h-10 object-contain drop-shadow-sm" />
              ) : (
                <span className="text-amber-500/70 font-bold">C</span>
              )}
            </div>
          </div>
        </div>
        
        {data.expReports && Object.values(data.expReports).some((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.amount > 0) && (
            <div className="bg-white shadow-sm -skew-x-[2deg] rounded-lg border border-slate-100">
              <div className="skew-x-[2deg] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h4 className="text-sm font-bold text-slate-800">경험치 보고서</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.values(data.expReports).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.amount > 0 && renderItem(item))}
                </div>
              </div>
            </div>
        )}

        {data.blueprints && Object.keys(data.blueprints).length > 0 && (
            <div className="bg-white shadow-sm -skew-x-[2deg] rounded-lg border border-slate-100">
              <div className="skew-x-[2deg] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h4 className="text-sm font-bold text-slate-800">장비 설계도</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Object.values(data.blueprints).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.amount > 0 && renderItem(item))}
                </div>
              </div>
            </div>
        )}

        {farmingRoutes && farmingRoutes.length > 0 && (
            <div className="bg-white shadow-sm -skew-x-[2deg] rounded-lg border border-slate-100">
              <div className="skew-x-[2deg] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                      <h4 className="text-sm font-bold text-slate-800">최적 파밍 견적서</h4>
                    </div>
                    <span className="text-xs text-slate-500">낭비 없이 필요 도면을 획득하기 위한 시뮬레이션 결과입니다.</span>
                  </div>
                  <div className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    총 예상 소모: {totalAP.toLocaleString()} AP
                  </div>
                </div>
                <div className="space-y-3">
                  {farmingRoutes.map((route: any, i: number) => (
                    <div key={`${route.stage}-${i}`} className="bg-white p-3 rounded-lg border border-emerald-100 flex flex-col gap-2 relative">
                      <div className="absolute top-2 right-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {route.runs}회 소탕 (소모 {route.expectedCost} AP)
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-slate-400">Step {i + 1}</span>
                        <span className="font-bold text-emerald-700 text-sm">스테이지 {route.stage}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {route.farmed.map((match: any, idx: number) => {
                           const iconUrl = getEquipmentIcon(match.type, match.tier);
                           return (
                             <div key={idx} className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 rounded p-1.5 w-16 hover:border-emerald-300 transition-colors shrink-0">
                               {iconUrl ? (
                                  <img src={getImageUrl(iconUrl)} className="w-8 h-8 object-contain drop-shadow-sm" alt="" />
                               ) : (
                                  <div className="w-8 h-8 bg-slate-200 rounded flex items-center justify-center text-[8px] text-slate-500">Img</div>
                               )}
                               <span className="text-[9px] font-bold text-slate-600 w-full text-center whitespace-normal leading-tight">T{match.tier} {getEquipmentLabel(match.type)}</span>
                               <span className="text-[8px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">획득: {match.amount}</span>
                             </div>
                           );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        )}

        {(data.elephs > 0 || (data.weaponItems && Object.keys(data.weaponItems).length > 0)) && (
            <div className="bg-white shadow-sm -skew-x-[2deg] rounded-lg border border-slate-100">
              <div className="skew-x-[2deg] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h4 className="text-sm font-bold text-slate-800">고유무기</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.elephs > 0 && renderItem({ name: isCombined ? '엘레프' : `${title.replace(' 필요 재화', '')}의 엘레프`, amount: data.elephs, iconUrl: schema?.resourceIcons?.Eleph || '' })}
                  {data.weaponItems && Object.values(data.weaponItems).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.amount > 0 && renderItem(item))}
                </div>
              </div>
            </div>
        )}

        {((data.bds && Object.keys(data.bds).length > 0) || (data.techNotes && Object.keys(data.techNotes).length > 0) || data.secret > 0) && (
            <div className="bg-white shadow-sm -skew-x-[2deg] rounded-lg border border-slate-100">
              <div className="skew-x-[2deg] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h4 className="text-sm font-bold text-slate-800">스킬 성장</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.bds && Object.values(data.bds).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.amount > 0 && renderItem(item))}
                  {data.techNotes && Object.values(data.techNotes).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.amount > 0 && renderItem(item))}
                  {data.secret > 0 && renderItem({ name: '비의서', amount: data.secret, iconUrl: schema?.resourceIcons?.SecretTechSheet || '' })}
                </div>
              </div>
            </div>
        )}

        {((data.ooparts && Object.keys(data.ooparts).length > 0) || (data.wbs && Object.keys(data.wbs).length > 0)) && (
            <div className="bg-white shadow-sm -skew-x-[2deg] rounded-lg border border-slate-100">
              <div className="skew-x-[2deg] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h4 className="text-sm font-bold text-slate-800">오파츠 & WB</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.ooparts && Object.values(data.ooparts).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.amount > 0 && renderItem(item))}
                  {data.wbs && Object.values(data.wbs).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.amount > 0 && renderItem(item))}
                </div>
              </div>
            </div>
        )}
      </div>
    </div>
  );
}
