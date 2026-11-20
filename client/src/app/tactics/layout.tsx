import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: '공략',
    template: '%s • Plana.AI',
  },
  description: '블루 아카이브 PvE 및 PvP 전술 공략 허브',
};

export default function TacticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
