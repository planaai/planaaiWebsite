import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/settings/',
        '/account/',
        '/login/',
        '/register/',
        '/formation-export/',
        '/student/',
        '/admin/',
        '/api/',
      ],
    },
    sitemap: 'https://plan4ai.fyi/sitemap.xml',
  };
}
