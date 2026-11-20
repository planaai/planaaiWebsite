import React from 'react';
import { ListCollapse } from 'lucide-react';

const formatDate = (d: Date) => {
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

interface Props {
  exportRef: React.RefObject<HTMLDivElement | null>;
  startDate: Date;
  targetDate: Date;
  today: Date;
  breakdown: { label: string; value: number }[];
  costBreakdown: { label: string; count: number; cost: number; perItem: number }[];
  totalCost: number;
  totalAmount: number;
}

export default function PyroxeneExportTemplate({
  exportRef,
  startDate,
  targetDate,
  today,
  breakdown,
  costBreakdown,
  totalCost,
  totalAmount
}: Props) {
  return (
    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
      <div
        ref={exportRef}
        className="bg-white p-10 w-[800px] relative font-sans text-gray-800"
        style={{ background: 'linear-gradient(to bottom right, #f4f7fb, #ffffff)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[var(--plana-primary)] pb-4 mb-6">
          <div className="flex items-center gap-4">
            <img src="/pyroxene.png" alt="Pyroxene" className="w-16 h-16 object-contain drop-shadow-md" />
            <div>
              <h2 className="text-3xl font-bold text-[var(--plana-text-main)] tracking-tight">청휘석 계산 보고서</h2>
              <div className="flex gap-4 mt-1 text-[var(--plana-text-muted)] text-[13px]">
                <p>결산 기간: {formatDate(startDate)} ~ {formatDate(targetDate)}</p>
                <p>| 작성일: {formatDate(today)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Left: Pyroxene Breakdown */}
          <div>
            <h3 className="text-lg font-bold text-[var(--plana-text-main)] mb-3 border-b pb-2 flex items-center gap-2">
              <ListCollapse className="w-5 h-5" /> 청휘석 수급 상세
            </h3>
            <div className="space-y-2">
              {breakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-[13px] border-b border-gray-100 pb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-bold flex items-center gap-1">
                    {item.value.toLocaleString()}
                    <img src="/pyroxene.png" alt="pyroxene" className="w-4 h-4 object-contain" />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Receipt */}
          <div>
            {costBreakdown.length > 0 ? (
              <div className="bg-[#f9f9f9] border border-gray-300 p-6 rounded shadow-sm relative font-mono text-gray-800 rotate-1 max-w-sm mx-auto">
                <div className="absolute top-2 right-2 w-16 h-16 drop-shadow-md z-10">
                  <img src="/images/mass.png" alt="Stamp" className="w-full h-full object-contain" />
                </div>
                <div className="text-center mb-4 border-b-2 border-dashed border-gray-400 pb-4 mt-2">
                  <h4 className="text-xl font-bold mb-1 tracking-tight">어른의 카드 청구서</h4>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">SCHALE Invoice</p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-[10px] text-gray-500 font-bold border-b border-gray-300 pb-1">
                    <span>ITEM</span>
                    <div className="flex gap-2 w-7/12 justify-end">
                      <span className="w-8 text-right">QTY</span>
                      <span className="w-20 text-right">AMOUNT</span>
                    </div>
                  </div>
                  {costBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] border-b border-gray-100 pb-1">
                      <span className="font-medium truncate pr-2">{item.label}</span>
                      <div className="flex gap-2 w-7/12 justify-end whitespace-nowrap">
                        <span className="w-8 text-right text-gray-600">x{item.count}</span>
                        <span className="w-20 text-right">₩{(item.cost).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t-2 border-dashed border-gray-400 pt-4 flex justify-between items-end">
                  <span className="font-bold text-lg tracking-tight">TOTAL</span>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 block mb-0.5">KRW</span>
                    <span className="text-xl font-extrabold text-[var(--plana-primary-dark)]">
                      ₩{totalCost.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--plana-text-muted)] text-sm border-2 border-dashed border-gray-300 bg-white/30 rounded-lg p-6 text-center font-bold">
                [보고서 가이드]<br />청구서를 여기에 부착해 주세요.
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 border-t-2 border-[var(--plana-primary)] pt-4 flex justify-between items-end">
          <div className="text-sm text-[var(--plana-text-muted)] font-bold flex items-center relative">
            <span className="relative z-10">문서 작성자 : 프라나</span>
            <div className="w-14 h-14 absolute -top-[26px] -right-12 -rotate-12 opacity-90 drop-shadow-sm">
              <img src="/images/plana_stamp.png" alt="Plana Stamp" className="w-full h-full object-contain scale-x-[-1]" />
            </div>
          </div>
          <div className="text-right text-[var(--plana-primary-dark)]">
            <p className="text-sm font-bold mb-1">예상 누적 청휘석</p>
            <p className="text-4xl font-extrabold flex items-center justify-end gap-2">
              {totalAmount.toLocaleString()}
              <img src="/pyroxene.png" alt="pyroxene" className="w-8 h-8 object-contain" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
