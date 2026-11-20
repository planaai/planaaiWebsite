export const SITE_NAME = 'Plana.AI';
export const SITE_URL = 'https://plan4ai.fyi';

/**
 * Formats full document title for browser tab (CSR or standalone strings).
 * Example:
 *  - formatTitle('학생도감') => '학생도감 • Plana.AI'
 *  - formatTitle('학생도감', '나기사(수영복)') => '학생도감: 나기사(수영복) • Plana.AI'
 */
export function formatTitle(feature: string, studentName?: string | null): string {
  const cleanFeature = feature.trim();
  const cleanStudent = studentName?.trim();
  if (cleanStudent) {
    return `${cleanFeature}: ${cleanStudent} • ${SITE_NAME}`;
  }
  return `${cleanFeature} • ${SITE_NAME}`;
}

/**
 * Formats title segment for Next.js metadata when root template `%s • Plana.AI` is active.
 * Example:
 *  - formatMetaTitle('학생도감') => '학생도감'
 *  - formatMetaTitle('학생도감', '나기사(수영복)') => '학생도감: 나기사(수영복)'
 */
export function formatMetaTitle(feature: string, studentName?: string | null): string {
  const cleanFeature = feature.trim();
  const cleanStudent = studentName?.trim();
  if (cleanStudent) {
    return `${cleanFeature}: ${cleanStudent}`;
  }
  return cleanFeature;
}

interface ArchiveApiResponseItem {
  master?: {
    id: number;
    name: string;
  };
}

interface ArchiveApiResponse {
  success?: boolean;
  data?: ArchiveApiResponseItem[];
}

  async function fetchArchiveItems(): Promise<ArchiveApiResponseItem[]> {
    try {
      const res = await fetch('https://api.plan4ai.fyi/api/archive', {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as ArchiveApiResponse;
      return Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Safely fetches student name by ID from the public archive endpoint with timeout and error fallback.
   * Used for SSR metadata generation in dynamic detail routes.
   */
  export async function getStudentNameById(id: number): Promise<string | null> {
    if (!id || isNaN(id) || id <= 0) return null;
    const items = await fetchArchiveItems();
    const item = items.find((d) => d.master?.id === id);
    return item?.master?.name?.trim() || null;
  }

  /**
   * Safely fetches public student IDs from the archive endpoint for sitemap generation.
   */
  export async function getArchiveStudentIds(): Promise<number[]> {
    const items = await fetchArchiveItems();
    return items
      .map((item) => item.master?.id)
      .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0);
  }
