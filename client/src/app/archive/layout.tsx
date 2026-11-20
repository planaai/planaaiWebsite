import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: '학생도감',
    template: '%s • Plana.AI',
  },
  description: '블루 아카이브 학생 정보 및 상세 스탯 도감',
};

export default function ArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
