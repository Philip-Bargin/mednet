import type { NextConfig } from "next";

const apiOrigin = (
  process.env.MEDNET_API_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

/**
 * Baseline browser protections for every page. A full script/style Content-Security-Policy needs
 * per-request nonces for Next's inline scripts and is deferred (see docs/SECURITY_AUDIT.md).
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];

    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
      {
        source: "/oauth2/:path*",
        destination: `${apiOrigin}/oauth2/:path*`,
      },
      {
        source: "/login/oauth2/:path*",
        destination: `${apiOrigin}/login/oauth2/:path*`,
      },
      {
        source: "/actuator/:path*",
        destination: `${apiOrigin}/actuator/:path*`,
      },
    ];
  },
};

export default nextConfig;
