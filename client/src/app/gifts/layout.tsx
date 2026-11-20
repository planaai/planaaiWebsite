import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '선물 도감',
  description: '블루 아카이브 학생별 선호 선물 도감',
};

export default function GiftsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
