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

  // JWT sessions carry no live status — a banned/suspended user's
  // existing session cookie stays cryptographically valid until it
  // naturally expires, so this real DB check is what actually locks
  // them out immediately on their next request. Every real
  // generate/publish action sits behind requireUser() or
  // requireCompany() below, so this one check covers all of them.
  // Deliberately just redirect() rather than signOut() — signOut()
  // needs to set a response cookie, which Server Components can't do;
  // the cookie is left in place, but every subsequent page load keeps
  // bouncing here regardless, which is sufficient lockout.
  const record = await db.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });
  if (!record) {
    redirect("/auth/login");
  }
  if (record.status !== "ACTIVE") {
    redirect(`/auth/login?status=${record.status.toLowerCase()}`);
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
  if (membership.company.status !== "ACTIVE") {
    redirect(`/auth/login?status=company_${membership.company.status.toLowerCase()}`);
  }

  return { user, company: membership.company, role: membership.role };
});
