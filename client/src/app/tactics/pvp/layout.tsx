import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plana.AI - PvP 공략',
  description: 'Personal Blue Archive progression tracker (PvP)',
};

export default function PvpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
