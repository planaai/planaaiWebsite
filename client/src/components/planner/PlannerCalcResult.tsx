import React, { useState } from 'react';
import { X, Coins, Layers } from 'lucide-react';
import { SchemaConfig } from '@/types';
import { getImageUrl } from './utils';

interface PlannerCalcResultProps {
  data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  title: string;
  isCombined?: boolean;
  schema: SchemaConfig | null;
  onClose: () => void;
}

type CategoryTab = 'all' | 'skills' | 'growth';

export function PlannerCalcResult({ data, title, isCombined = false, schema, onClose }: PlannerCalcResultProps) {
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');

  if (!data) return null;

  const skillItemCount =
    (data.bds ? Object.values(data.bds).filter((i: any) => i.amount > 0).length : 0) +
    (data.techNotes ? Object.values(data.techNotes).filter((i: any) => i.amount > 0).length : 0) +
    (data.ooparts ? Object.values(data.ooparts).filter((i: any) => i.amount > 0).length : 0) +
    (data.wbs ? Object.values(data.wbs).filter((i: any) => i.amount > 0).length : 0) +
    (data.secret > 0 ? 1 : 0);

  const growthItemCount =
    (data.expReports ? Object.values(data.expReports).filter((i: any) => i.amount > 0).length : 0) +
    (data.weaponItems ? Object.values(data.weaponItems).filter((i: any) => i.amount > 0).length : 0) +
    (data.elephs > 0 ? 1 : 0);

  const renderItem = (item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
    <div
      key={item.name}
      className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between hover:border-sky-400/60 transition-colors shadow-2xs"
    >
      <div className="flex items-center gap-2.5 overflow-hidden flex-1">
        {item.iconUrl ? (
          <img src={getImageUrl(item.iconUrl)} className="w-8 h-8 object-contain shrink-0" alt="" />
        ) : (
          <div className="w-8 h-8 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] text-slate-400 border border-slate-200">
            Img
          </div>
        )}
        <span className="text-slate-700 truncate font-bold text-xs sm:text-sm" title={item.name}>
          {item.name}
        </span>
      </div>
      <span className="text-slate-900 font-black shrink-0 ml-2 text-sm tabular-nums bg-slate-100 px-2 py-0.5 rounded-md">
        ×{item.amount.toLocaleString()}
      </span>
    </div>
  );

  const showSection = (tab: CategoryTab) => activeTab === 'all' || activeTab === tab;

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 bg-slate-50/70">
        <div>
          <span
            className={`inline-block -skew-x-6 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border mb-0.5 ${
              isCombined
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-[var(--plana-primary-light)]/40 text-[var(--plana-primary-dark)] border-[var(--plana-border)]'
            }`}
          >
            <span className="inline-block skew-x-6">{isCombined ? 'Combined Report' : 'Resource Report'}</span>
          </span>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          aria-label="닫기"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Top KPI Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          <div className="md:col-span-7 bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700/80 flex items-center gap-1.5">
                <Coins size={13} /> 총 필요 크레딧
              </span>
              <div className="text-2xl font-black text-amber-600 tabular-nums mt-1">
                {data.credits.toLocaleString()}
              </div>
            </div>
            {schema?.resourceIcons?.Credit && (
              <img src={getImageUrl(schema.resourceIcons.Credit)} alt="Credit" className="w-10 h-10 object-contain" />
            )}
          </div>

          <div className="md:col-span-5 bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers size={13} /> 필요 재화 종수
            </span>
            <div className="text-sm font-bold text-slate-700 tabular-nums mt-1.5">
              스킬·오파츠 <span className="text-rose-500">{skillItemCount}종</span> · 경험치·전무{' '}
              <span className="text-sky-600">{growthItemCount}종</span>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200/80 pb-3">
          {[
            { id: 'all', label: '전체 보기' },
            { id: 'skills', label: `스킬 · 오파츠 (${skillItemCount})` },
            { id: 'growth', label: `경험치 · 고유무기 (${growthItemCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as CategoryTab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-[var(--plana-primary-dark)] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Skills & Ooparts */}
        {showSection('skills') && skillItemCount > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {((data.bds && Object.keys(data.bds).length > 0) ||
              (data.techNotes && Object.keys(data.techNotes).length > 0) ||
              data.secret > 0) && (
              <section className="bg-slate-50/70 rounded-xl border border-slate-200/70 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 rounded-full bg-sky-500" />
                  BD · 기술노트 · 비의서
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {data.bds && Object.values(data.bds).map((item: any) => item.amount > 0 && renderItem(item))}
                  {data.techNotes &&
                    Object.values(data.techNotes).map((item: any) => item.amount > 0 && renderItem(item))}
                  {data.secret > 0 &&
                    renderItem({
                      name: '비의서',
                      amount: data.secret,
                      iconUrl: schema?.resourceIcons?.SecretTechSheet || '',
                    })}
                </div>
              </section>
            )}

            {((data.ooparts && Object.keys(data.ooparts).length > 0) ||
              (data.wbs && Object.keys(data.wbs).length > 0)) && (
              <section className="bg-slate-50/70 rounded-xl border border-slate-200/70 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 rounded-full bg-rose-400" />
                  오파츠 · 능력 개방(WB)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {data.ooparts && Object.values(data.ooparts).map((item: any) => item.amount > 0 && renderItem(item))}
                  {data.wbs && Object.values(data.wbs).map((item: any) => item.amount > 0 && renderItem(item))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Exp & Weapon */}
        {showSection('growth') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.expReports && Object.values(data.expReports).some((item: any) => item.amount > 0) && (
              <section className="bg-slate-50/70 rounded-xl border border-slate-200/70 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 rounded-full bg-sky-500" />
                  경험치 보고서
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.values(data.expReports).map((item: any) => item.amount > 0 && renderItem(item))}
                </div>
              </section>
            )}

            {(data.elephs > 0 || (data.weaponItems && Object.keys(data.weaponItems).length > 0)) && (
              <section className="bg-slate-50/70 rounded-xl border border-slate-200/70 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 rounded-full bg-purple-500" />
                  엘레프 · 고유무기
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {data.elephs > 0 &&
                    renderItem({
                      name: isCombined ? '엘레프' : `${title.replace(' 필요 재화', '')}의 엘레프`,
                      amount: data.elephs,
                      iconUrl: schema?.resourceIcons?.Eleph || '',
                    })}
                  {data.weaponItems &&
                    Object.values(data.weaponItems).map((item: any) => item.amount > 0 && renderItem(item))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
