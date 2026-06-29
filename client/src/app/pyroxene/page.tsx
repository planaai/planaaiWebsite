import React from 'react';
import { getPyroxeneData, fetchScheduledEvents } from '@/lib/pyroxeneParser';
import PyroxeneCalculator from '@/components/PyroxeneCalculator';

export default async function PyroxenePage() {
  const pyroxeneData = getPyroxeneData();
  const scheduledEvents = await fetchScheduledEvents();

  return (
    <div className="w-full">
      <PyroxeneCalculator data={pyroxeneData} events={scheduledEvents} />
    </div>
  );
}
