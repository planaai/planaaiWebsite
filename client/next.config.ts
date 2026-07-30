import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // _next 내부 라우트와 api 라우트를 제외한 모든 라우트에 대해 캐시 적용
        source: '/:path((?!_next/|api/).*)',
        headers: [
          {
            key: 'Cache-Control',
            // 브라우저는 캐시하지 않되(항상 최신 확인), Cloudflare Edge 서버는 24시간(86400초) 캐시
            value: 'public, max-age=0, s-maxage=86400, stale-while-revalidate=2592000',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/pvp',
        destination: 'https://planaai-pvp.pages.dev/pvp',
      },
      {
        source: '/pvp/:path*',
        destination: 'https://planaai-pvp.pages.dev/pvp/:path*',
      },
    ];
  },
};

export default nextConfig;
