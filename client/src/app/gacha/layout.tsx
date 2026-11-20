import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '가챠 시뮬레이터',
  description: '블루 아카이브 픽업 및 앙코르 모집 가챠 시뮬레이터',
};

export default function GachaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
