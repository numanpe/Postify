import "server-only";
import { cache } from "react";

import { auth } from "@/auth";
import { resolveActiveMembership } from "@/lib/session";
import type { Locale } from "./dictionaries";

// Wrapped in React's cache() so the root layout and any page rendering
// in the same request share one DB lookup instead of N — Next.js dedupes
// cache()-wrapped calls per request automatically.
export const getLocale = cache(async (): Promise<Locale> => {
  const session = await auth();
  if (!session?.user) return "en";

  // Same active-company resolution requireCompany() uses (see
  // src/lib/session.ts) — otherwise a multi-company user's locale would
  // always reflect their oldest company regardless of which one is
  // actually active, not the company they're currently viewing.
  const membership = await resolveActiveMembership(session.user.id);

  return membership?.company.locale === "AR" ? "ar" : "en";
});
