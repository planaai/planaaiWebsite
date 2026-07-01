import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare 배포 시 rewrites 대신 환경 변수(NEXT_PUBLIC_API_URL)를 사용하여 직접 백엔드 도메인을 호출하도록 변경
};

export default nextConfig;
