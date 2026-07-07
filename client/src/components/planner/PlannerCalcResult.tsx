import React from 'react';
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
  if (!data) return null;

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
    <div className={`p-5 rounded-xl border h-full overflow-y-auto custom-scrollbar flex flex-col ${isCombined ? 'bg-slate-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex justify-between items-center mb-5 sticky top-0 bg-white/90 backdrop-blur-sm p-3 rounded-xl z-10 shadow-sm border border-slate-100">
        <h3 className={`text-lg font-bold flex items-center gap-2 ${isCombined ? 'text-emerald-500' : 'text-[var(--plana-primary)]'}`}>
          {title}
        </h3>
        <button onClick={onClose} className="p-1.5 bg-slate-50 text-slate-400 hover:text-[var(--plana-primary)] hover:bg-pink-50 rounded-lg transition-colors">
          <X size={20}/>
        </button>
      </div>
      
      <div className="space-y-6 flex-1 pb-4">
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
            <div className="bg-white shadow-sm -skew-x-[5deg] rounded-lg border border-slate-100">
              <div className="skew-x-[5deg] p-6">
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
            <div className="bg-white shadow-sm -skew-x-[5deg] rounded-lg border border-slate-100">
              <div className="skew-x-[5deg] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-[var(--plana-primary)]"></div>
                  <h4 className="text-sm font-bold text-slate-800">장비 설계도</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {Object.values(data.blueprints).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.amount > 0 && renderItem(item))}
                </div>
              </div>
            </div>
        )}

        {(data.elephs > 0 || (data.weaponItems && Object.keys(data.weaponItems).length > 0)) && (
            <div className="bg-white shadow-sm -skew-x-[5deg] rounded-lg border border-slate-100">
              <div className="skew-x-[5deg] p-6">
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
            <div className="bg-white shadow-sm -skew-x-[5deg] rounded-lg border border-slate-100">
              <div className="skew-x-[5deg] p-6">
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
            <div className="bg-white shadow-sm -skew-x-[5deg] rounded-lg border border-slate-100">
              <div className="skew-x-[5deg] p-6">
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
