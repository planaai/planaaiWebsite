import type { Metadata } from 'next';
import { formatMetaTitle } from '@/lib/seo';

export const metadata: Metadata = {
  title: formatMetaTitle('OpenAPI'),
  description: 'Plana.AI 비공식 블루 아카이브 API 레퍼런스 및 호출 가이드',
};

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
