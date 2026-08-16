import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Recharts SSR compatibility
  transpilePackages: ['recharts'],
};

export default nextConfig;
