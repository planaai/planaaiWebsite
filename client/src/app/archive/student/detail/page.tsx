import type { Metadata } from 'next';
import { Suspense } from 'react';
import { formatMetaTitle, getStudentNameById } from '@/lib/seo';
import ArchiveStudentContent from './ArchiveStudentContent';

export const runtime = 'edge';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const rawId = params?.id;
  const id = typeof rawId === 'string' ? Number(rawId) : Array.isArray(rawId) ? Number(rawId[0]) : undefined;
  const studentName = id ? await getStudentNameById(id) : null;

  return {
    title: formatMetaTitle('학생도감', studentName),
    description: studentName
      ? `블루 아카이브 ${studentName} 학생 상세 정보 및 스탯 도감`
      : '블루 아카이브 학생 정보 및 상세 스탯 도감',
  };
}

export default function ArchiveStudentPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading...</div>}>
      <ArchiveStudentContent />
    </Suspense>
  );
}
