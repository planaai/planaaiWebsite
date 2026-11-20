import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PvE 공략',
  description: '블루 아카이브 총력전 및 대결전 PvE 공략',
};

export default function PveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
