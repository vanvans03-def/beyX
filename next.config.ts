import { execSync } from "child_process";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  generateBuildId: async () => {
    // 1. Check for environment variable (useful for CI/CD like Vercel or Docker build args)
    if (process.env.NEXT_PUBLIC_BUILD_ID) {
      return process.env.NEXT_PUBLIC_BUILD_ID;
    }

    try {
      // 2. Try to use current git commit hash (local development)
      return execSync('git rev-parse HEAD', { stdio: 'pipe' }).toString().trim();
    } catch (e) {
      // 3. Fallback to a static ID if everything else fails
      return 'production-build-' + new Date().toISOString().split('T')[0];
    }
  },
};

export default nextConfig;

