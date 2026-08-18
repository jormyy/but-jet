import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  // Required for Recharts SSR compatibility
  transpilePackages: ['recharts'],
};

export default withSerwist(nextConfig);
