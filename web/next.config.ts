import type { NextConfig } from "next";

const apiOrigin = (
  process.env.MEDNET_API_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

function publicSupabaseKey(): string | undefined {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPERBASE_PUBLISHABLE_KEY;
  if (!key) return undefined;
  if (key.startsWith("sb_publishable_")) return key;

  const encodedClaims = key.split(".")[1];
  if (encodedClaims) {
    try {
      const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as {
        role?: string;
      };
      if (claims.role === "anon") return key;
    } catch {
      // The generic error below avoids ever logging a configured key.
    }
  }
  throw new Error(
    "The public Supabase key must be a publishable key or a legacy anon key; secret/service-role keys cannot be bundled.",
  );
}

const publicSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPERBASE_PROJECT_URL;
const publishableSupabaseKey = publicSupabaseKey();

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
  env: {
    ...(publicSupabaseUrl ? { NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl } : {}),
    ...(publishableSupabaseKey
      ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableSupabaseKey }
      : {}),
  },
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
        source: "/actuator/:path*",
        destination: `${apiOrigin}/actuator/:path*`,
      },
    ];
  },
};

export default nextConfig;
