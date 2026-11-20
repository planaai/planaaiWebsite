import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '육성 플래너',
  description: '블루 아카이브 학생 성장 및 스킬 육성 재화 플래너',
};

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
