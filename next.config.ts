import type { NextConfig } from "next";

// Rewrites are fixed at build time. On a hosted build (Vercel, Netlify, Render) a missing
// value would silently proxy every API call to localhost, so fail the build instead.
if ((process.env.VERCEL || process.env.NETLIFY || process.env.RENDER) && !process.env.BACKEND_INTERNAL_URL) {
  throw new Error("BACKEND_INTERNAL_URL must be set to the public API URL (e.g. https://api.example.com).");
}
const backend = (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin tracing to this app so a lockfile in a parent folder doesn't change the standalone layout.
  outputFileTracingRoot: process.cwd(),
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser only ever talks to this origin; the Next server proxies API and
  // upload traffic to the backend so auth cookies stay first-party.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
      // Bull Board queue dashboard (auth enforced by the API).
      { source: "/admin/queues", destination: `${backend}/admin/queues` },
      { source: "/admin/queues/:path*", destination: `${backend}/admin/queues/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
