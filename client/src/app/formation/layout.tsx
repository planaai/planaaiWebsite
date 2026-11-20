import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '모의 편성',
  description: '블루 아카이브 파티 시뮬레이션 및 모의 편성',
};

export default function FormationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
