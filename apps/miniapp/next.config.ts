import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@course/shared"],
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
