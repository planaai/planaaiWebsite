import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: '컬렉션',
    template: '%s • Plana.AI',
  },
  description: '선생님의 보유 학생 육성 상세 정보',
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
