import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '문의사항',
  description: 'Plana.AI 서비스 버그 제보 및 기능 제안 문의사항',
};

export default function InquiriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
