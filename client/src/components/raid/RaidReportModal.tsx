import React from 'react';
import { ReportModal } from '@/components/common/ReportModal';

interface Props {
  partyId: number | string;
  partyName: string;
  onClose: () => void;
}

export function RaidReportModal({ partyId, partyName, onClose }: Props) {
  return (
    <ReportModal
      partyId={partyId}
      partyName={partyName}
      targetType="raid"
      onClose={onClose}
    />
  );
}
