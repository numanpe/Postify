import type { Metadata, Viewport } from "next";
import { Fraunces, Karla, Tajawal } from "next/font/google";
import "./globals.css";

import { getLocale } from "@/lib/i18n/get-locale";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "900"],
  variable: "--font-fraunces",
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-karla",
  display: "swap",
});

// Same bundled family as the poster/video render pipeline's Tajawal
// TTFs (src/lib/fonts.ts) — different loading mechanism (next/font vs.
// Satori's raw font-file API) for a different rendering context (live
// DOM vs. server-side SVG), same actual typeface, so the web UI and the
// generated content agree visually for Arabic.
const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Postify",
  description: "AI marketing content platform",
  appleWebApp: { title: "Postify" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#C1272D" },
    { media: "(prefers-color-scheme: dark)", color: "#E14B4B" },
  ],
  // Without this, env(safe-area-inset-*) always evaluates to 0 on iOS —
  // required for the fixed bottom nav's safe-area padding to do
  // anything on notched/home-indicator devices.
  viewportFit: "cover",
};

// LocaleProvider deliberately does NOT wrap {children} here anymore —
// it moved to (app)/layout.tsx, the only route group that actually
// consumes useDict()/useLocale() (confirmed by an exhaustive grep: zero
// hits in (auth), (onboarding), or the root marketing page). Resolving
// the dictionary is unavoidably client-side (see locale-provider.tsx's
// doc comment — functions can't cross the RSC boundary), so having this
// provider in the root layout meant every route, including /auth/login,
// statically imported the full bilingual dictionaries.ts and shipped it
// to the browser regardless of whether anything in that page's tree
// ever called useDict(). Real measured impact: ~47KB off every
// pre-auth/marketing page's JS payload. getLocale() itself stays here —
// it's server-only and drives the real <html lang/dir> attributes for
// every page, unrelated to the client Context this file no longer sets up.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${fraunces.variable} ${karla.variable} ${tajawal.variable}`}
    >
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased dark:bg-night dark:text-ink-dark">
        {children}
      </body>
    </html>
  );
}
