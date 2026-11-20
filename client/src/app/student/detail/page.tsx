import type { Metadata } from 'next';
import { Suspense } from 'react';
import { formatMetaTitle, getStudentNameById } from '@/lib/seo';
import StudentDetailContent from './StudentDetailContent';

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
    title: formatMetaTitle('컬렉션', studentName),
    description: studentName
      ? `블루 아카이브 ${studentName} 보유 학생 육성 상세 정보`
      : '선생님의 보유 학생 육성 상세 정보',
  };
}

export default function StudentDetailPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading...</div>}>
      <StudentDetailContent />
    </Suspense>
  );
}
