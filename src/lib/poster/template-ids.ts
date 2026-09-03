// Real production bug found here: this list used to live as a plain
// exported const inside poster-form.tsx ("use client"). Next.js's RSC
// compiler replaces EVERY named export of a "use client" module with a
// client-reference stub when a Server Component imports from it — not
// just the component export — so studio/[mode]/page.tsx and
// studio/design/page.tsx (both Server Components) were receiving an
// opaque reference object instead of the real array, and crashing with
// "availableTemplates.map is not a function" inside
// getPreferredTemplateOrder. Every /studio/poster and /studio/design
// load 500'd. A plain, non-"use client" module is the fix: both the
// client form and the server pages can safely import from here.
//
// Mirrors the Prisma PosterTemplate enum (prisma/schema.prisma) exactly
// — kept as a literal tuple (not derived from the Prisma client) so
// this file has zero dependencies and can be imported from both
// server and client bundles without pulling in @prisma/client.
export const TEMPLATE_IDS = [
  "MINIMAL",
  "BOLD_HEADLINE",
  "PROMOTIONAL_BANNER",
  "SPLIT_PRODUCT",
  "MODERN_BANNER",
  "BADGE_OFFER",
  "MINIMALIST_FRAME",
  "INFOGRAPHIC_SHOWCASE",
] as const;
