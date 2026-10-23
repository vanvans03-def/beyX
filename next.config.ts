import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.NEXT_TYPESCRIPT_CONFIG || 'tsconfig.json' },
  output: 'standalone',
  async redirects() {
    // Keep previously scraped image URLs working, without overriding page OG metadata.
    return [
      { source: '/opengraph-image', destination: '/beyx-share-v2.png', permanent: false },
      { source: '/register/:id/opengraph-image', destination: '/beyx-bracket-v2.png', permanent: false },
    ];
  },
  generateBuildId: async () => {
    return process.env.NEXT_PUBLIC_BUILD_ID || 'v1.0.0';
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fvvmw9tdy563ysth.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'pub-6f0157dfdc22476c9fb6cf71238ed235.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },
};

export default nextConfig;
