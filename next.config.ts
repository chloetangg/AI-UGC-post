import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  agentRules: false,
  serverExternalPackages: ["@resvg/resvg-js", "sharp", "fontkit", "wawoff2", "mongodb"],
  outputFileTracingIncludes: {
    "/api/compose-cover": ["./public/fonts/**/*", "./public/cover/**/*"],
    "/app/api/compose-cover/route": ["./public/fonts/**/*", "./public/cover/**/*"],
  },
  experimental: {
    proxyClientMaxBodySize: "1gb",
  },
};

export default nextConfig;
