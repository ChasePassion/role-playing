import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
