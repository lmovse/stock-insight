import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pinyin", "node-cron", "bcryptjs"],
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
