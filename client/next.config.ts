import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://140.245.70.15/api/:path*'
      },
      {
        source: '/uploads/:path*',
        destination: 'http://140.245.70.15/uploads/:path*'
      }
    ];
  }
};

export default nextConfig;
