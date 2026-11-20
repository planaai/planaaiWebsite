import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '컬렉션',
  description: '선생님의 보유 학생 육성 상태 관리 및 컬렉션',
};

export default function CollectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
