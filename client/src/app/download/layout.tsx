import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '유틸리티 다운로드',
  description: 'Plana.AI 데스크톱 유틸리티 프로그램 다운로드',
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
