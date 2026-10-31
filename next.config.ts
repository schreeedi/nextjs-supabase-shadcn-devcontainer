import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Origin of the Supabase API the browser talks to (baked in at build time). */
function supabaseOrigin(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
}

// Content-Security-Policy. headers() ends up in the routes manifest at build
// time, so only use build-time values here.
// - script-src 'unsafe-inline': Next inlines its bootstrap/RSC payload scripts
//   and statically prerendered pages get no per-request nonce. 'unsafe-eval'
//   only in dev (HMR / React debugging).
// - img-src https:: OAuth avatars come from provider CDNs (Google, GitHub,
//   Facebook …). Tighten to explicit hosts once the provider list is fixed.
// - form-action: the OAuth server action redirects to Supabase, which
//   redirects on to the provider — browsers check the whole chain.
// - upgrade-insecure-requests: production only — in dev it would rewrite
//   http://127.0.0.1:54321 (local Supabase) to https and break it.
// - Add third-party origins (Stripe, analytics, …) here as you introduce them.
function contentSecurityPolicy(): string {
  const supabase = supabaseOrigin();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      ...(supabase ? [supabase] : []),
      ...(isDev ? ["ws:"] : []),
    ],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": [
      "'self'",
      ...(supabase ? [supabase] : []),
      "https://accounts.google.com",
      "https://www.facebook.com",
    ],
    "frame-ancestors": ["'none'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives)
    .map(([key, values]) => [key, ...values].join(" "))
    .join("; ");
}

const nextConfig: NextConfig = {
  // No images.remotePatterns: nothing uses next/image yet (avatars are plain
  // <img> via Radix). When it does, list the real provider hosts + pathname.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          // Legacy twin of frame-ancestors (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
