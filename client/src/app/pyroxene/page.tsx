import React from 'react';
import type { Metadata } from 'next';
import { getPyroxeneData, fetchScheduledEvents } from '@/lib/pyroxeneParser';
import PyroxeneCalculator from '@/components/PyroxeneCalculator';

export const metadata: Metadata = {
  title: '청휘석 계산기',
  description: '블루 아카이브 청휘석 수급 및 미래시 계산기',
};

export default async function PyroxenePage() {
  const pyroxeneData = getPyroxeneData();
  const scheduledEvents = await fetchScheduledEvents();

  return (
    <div className="w-full">
      <PyroxeneCalculator data={pyroxeneData} events={scheduledEvents} />
    </div>
  );
}
