import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/.well-known/skills/index.json',
        destination: '/.well-known/skills',
      },
    ];
  },
};

export default nextConfig;
