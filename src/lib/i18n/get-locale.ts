import "server-only";
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Locale } from "./dictionaries";

// Wrapped in React's cache() so the root layout and any page rendering
// in the same request share one DB lookup instead of N — Next.js dedupes
// cache()-wrapped calls per request automatically.
export const getLocale = cache(async (): Promise<Locale> => {
  const session = await auth();
  if (!session?.user) return "en";

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
    include: { company: { select: { locale: true } } },
    orderBy: { createdAt: "asc" },
  });

  return membership?.company.locale === "AR" ? "ar" : "en";
});
