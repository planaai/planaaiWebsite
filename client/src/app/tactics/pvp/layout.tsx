import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PvP 공략',
  description: '블루 아카이브 전술경연대회 PvP 공략 및 메타 분석',
};

export default function PvpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
