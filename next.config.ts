import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: false,
  // Set by the Dockerfile. Standalone builds can need extra symlink permissions
  // on Windows, so local builds skip it.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
};

export default nextConfig;
