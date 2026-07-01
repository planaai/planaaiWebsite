import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 모든 라우트에 대해 Cloudflare Edge Cache(CDN)를 활성화합니다.
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            // 브라우저는 캐시하지 않되(항상 최신 확인), Cloudflare Edge 서버는 24시간(86400초) 캐시
            // 결과적으로 Cloudflare Worker는 하루에 딱 1번만 실행되고 이후엔 무료 CDN에서 서빙됩니다.
            value: 'public, max-age=0, s-maxage=86400, stale-while-revalidate=2592000',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
