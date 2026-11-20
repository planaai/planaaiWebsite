import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '편성 데이터 내보내기',
  robots: {
    index: false,
    follow: false,
  },
};

export default function FormationExportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
