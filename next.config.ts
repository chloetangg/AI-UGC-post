import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  agentRules: false,
  serverExternalPackages: ["@resvg/resvg-js", "sharp", "fontkit", "wawoff2", "mongodb"],
  experimental: {
    proxyClientMaxBodySize: "1gb",
  },
};

export default nextConfig;
