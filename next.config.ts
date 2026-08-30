import type { NextConfig } from "next";

// Scoped to what this app actually loads, confirmed by checking rather
// than guessed: both storage backends (src/lib/storage.ts) serve every
// image/video/audio through this app's own /api/storage/* route, never a
// direct external CDN URL, and no client component makes any cross-origin
// fetch() (verified via grep — zero matches). challenges.cloudflare.com is
// Turnstile's real widget origin (src/components/auth/signup-form.tsx).
//
// script-src/style-src allow 'unsafe-inline' as a real, deliberate
// tradeoff: this app has no middleware.ts, and a strict nonce-based CSP
// (blocking inline scripts entirely) needs one to inject a per-request
// nonce into both this header and Next's own rendered inline hydration
// scripts — a separate, larger change than this pass took on. This still
// blocks the concrete risk named in the security audit (clickjacking via
// frame-ancestors, and loading anything from an attacker-controlled
// remote origin via script-src/img-src/connect-src).
// 'unsafe-eval' only in development — React's dev-mode debugging (stack
// trace reconstruction for HMR/DevTools) genuinely needs it; confirmed via
// a real console error when it was missing ("eval() is not supported...
// React requires eval() in development mode... React will never use
// eval() in production mode" — that last line is React's own guarantee,
// not an assumption). Production stays strict.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
  // Default is 1MB, which most real photos already exceed — media
  // uploads (src/lib/actions/media.ts) need real room. The per-file/
  // per-request caps enforced there stay well under this ceiling; this
  // just stops Next's own default from rejecting valid uploads first.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // @resvg/resvg-js ships a native binding loaded via a dynamic
  // require() that Turbopack's bundler can't statically resolve
  // ("non-ecmascript placeable asset"). @ffmpeg-installer/ffmpeg and
  // @ffprobe-installer/ffprobe similarly ship a platform-specific
  // binary resolved via a dynamic require(). All three need to opt out
  // of bundling in favor of plain Node require, same as sharp already
  // gets automatically (sharp is on Next's built-in external-packages
  // list; these aren't).
  serverExternalPackages: [
    "@resvg/resvg-js",
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
  ],
};

export default nextConfig;
