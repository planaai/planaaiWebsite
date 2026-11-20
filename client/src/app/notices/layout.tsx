import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '공지사항',
  description: 'Plana.AI 서비스 업데이트 및 공지사항',
};

export default function NoticesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
