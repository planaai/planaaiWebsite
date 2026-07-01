import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://140.245.70.15.nip.io/api/:path*'
      },
      {
        source: '/uploads/:path*',
        destination: 'http://140.245.70.15.nip.io/uploads/:path*'
      }
    ];
  }
};

export default nextConfig;
