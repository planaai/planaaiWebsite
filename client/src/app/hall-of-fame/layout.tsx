import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '명예의 전당',
  description: 'Plana.AI 프로젝트 기여 및 후원 명예의 전당',
};

export default function HallOfFameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
