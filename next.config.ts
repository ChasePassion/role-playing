import type { NextConfig } from "next";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";

const baseConfig: NextConfig = {
  // Disable compression so SSE responses aren't buffered by the proxy layer.
  // (Streaming endpoints rely on incremental flush of chunks.)
  compress: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/v1/:path*",
        headers: [
          // Avoid intermediaries buffering or transforming SSE streams.
          { key: "Cache-Control", value: "no-cache, no-transform" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "http://localhost:8000/uploads/:path*",
      },
      {
        source: "/v1/:path*",
        destination: "http://localhost:8000/v1/:path*",
      },
    ];
  },
};

export default function nextConfig(phase: string): NextConfig {
  const distDir =
    phase === PHASE_DEVELOPMENT_SERVER
      ? ".next-dev"
      : phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER
        ? ".next-prod"
        : ".next";

  return {
    ...baseConfig,
    distDir,
  };
}
