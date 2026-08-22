import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";

// Real perf bug found while diagnosing slow /studio loads: every
// (app)/ page calls requireCompany() itself, AND the (app) layout
// wrapping it calls requireCompany() independently too — two full,
// un-deduplicated CompanyMember+Company round-trips to Neon for the
// exact same data on every single authenticated page load (three,
// counting getLocale()'s own separate membership lookup, which was
// already correctly cache()-wrapped — see its own comment making the
// same point). Wrapping these in React's cache() the same proven way
// getLocale() already does means Next dedupes the call across every
// Server Component in one request automatically, cutting it back down
// to one real query.
export const requireUser = cache(async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login");
  }
  return session.user;
});

// The multi-tenant boundary: resolves the caller's company strictly from
// their CompanyMember row, never from a client-supplied companyId. Every
// company-scoped data access in the app should go through this (or a
// query that includes an equivalent membership check), per CLAUDE.md's
// data-layer isolation requirement.
export const requireCompany = cache(async function requireCompany() {
  const user = await requireUser();

  const membership = await db.companyMember.findFirst({
    where: { userId: user.id },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    redirect("/create-company");
  }

  return { user, company: membership.company, role: membership.role };
});
