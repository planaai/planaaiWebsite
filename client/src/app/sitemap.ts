import type { MetadataRoute } from 'next';
import { getArchiveStudentIds, SITE_URL } from '@/lib/seo';

  export const revalidate = 3600;

  export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const routes: Array<{
      path: string;
      priority: number;
      changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    }> = [
        { path: '', priority: 1.0, changeFrequency: 'daily' },
        { path: '/archive', priority: 0.9, changeFrequency: 'weekly' },
        { path: '/collection', priority: 0.8, changeFrequency: 'weekly' },
        { path: '/gifts', priority: 0.8, changeFrequency: 'monthly' },
        { path: '/gacha', priority: 0.8, changeFrequency: 'weekly' },
        { path: '/planner', priority: 0.8, changeFrequency: 'weekly' },
        { path: '/formation', priority: 0.8, changeFrequency: 'weekly' },
        { path: '/pyroxene', priority: 0.7, changeFrequency: 'monthly' },
        { path: '/ap-calculator', priority: 0.7, changeFrequency: 'monthly' },
        { path: '/tactics', priority: 0.8, changeFrequency: 'weekly' },
        { path: '/tactics/pve', priority: 0.7, changeFrequency: 'weekly' },
        { path: '/tactics/pvp', priority: 0.7, changeFrequency: 'weekly' },
        { path: '/download', priority: 0.6, changeFrequency: 'monthly' },
        { path: '/notices', priority: 0.7, changeFrequency: 'weekly' },
        { path: '/inquiries', priority: 0.5, changeFrequency: 'monthly' },
        { path: '/hall-of-fame', priority: 0.6, changeFrequency: 'monthly' },
      ];

    const baseEntries: MetadataRoute.Sitemap = routes.map((route) => ({
      url: `${SITE_URL}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }));

    const studentIds = await getArchiveStudentIds();
    const studentEntries: MetadataRoute.Sitemap = studentIds.map((id) => ({
      url: `${SITE_URL}/archive/student/detail?id=${id}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    return [...baseEntries, ...studentEntries];
  }
