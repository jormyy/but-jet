import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  // Required for Recharts SSR compatibility
  transpilePackages: ['recharts'],
  turbopack: {
    root: __dirname,
  },
};

export default withSerwist(nextConfig);
