import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pinyin", "node-cron", "bcryptjs"],
};

export default nextConfig;
