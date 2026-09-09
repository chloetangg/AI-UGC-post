import os from "node:os";
import type { NextConfig } from "next";

function lanDevOrigins() {
  const origins = new Set<string>(["127.0.0.1", "192.168.*.*", "10.*.*.*"]);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) origins.add(addr.address);
    }
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
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
