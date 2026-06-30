import React from 'react';
import { ApCalculator } from '@/components/ap-calculator/ApCalculator';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AP 존버 계산기 | PLANA.AI',
  description: '블루 아카이브 이벤트를 위해 최대한 많은 AP를 모으는 스케줄을 계산합니다.',
};

export default function ApCalculatorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8 text-[var(--plana-primary)]">AP 존버 시뮬레이터</h1>
      <ApCalculator />
    </div>
  );
}
