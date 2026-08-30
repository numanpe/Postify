import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { db } from "@/lib/db";

// Shared by requireCompany() below, get-locale.ts, and the OAuth callback
// routes (src/app/api/social/*/callback/route.ts) — one real cookie name,
// not a string repeated at every read/write site.
export const ACTIVE_COMPANY_COOKIE = "active_company_id";

// Multi-company support: a user's CompanyMember rows are the real list of
// companies they belong to (already many-to-many, no schema change needed
// here); this resolves which ONE is currently active. A stale/invalid
// cookie (a removed membership, a company that no longer exists) silently
// falls back to the oldest membership — the app's exact pre-multi-company
// behavior — never an error, since a bad cookie value should never lock a
// real user out of their own company.
//
// cache()-wrapped for the same reason requireUser()/requireCompany() below
// already are — requireCompany() and getLocale() (and, per-request, the
// OAuth callback routes) all call this independently; without cache() that
// would reintroduce the exact "N un-deduplicated round trips per request"
// bug this file's requireUser() comment already documents fixing once.
export const resolveActiveMembership = cache(async function resolveActiveMembership(userId: string) {
  const [cookieStore, memberships] = await Promise.all([
    cookies(),
    db.companyMember.findMany({
      where: { userId },
      include: { company: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (memberships.length === 0) return null;
  const activeId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  return memberships.find((m) => m.companyId === activeId) ?? memberships[0];
});

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
  // Routes through /api/auth/force-signout rather than redirecting
  // straight to /auth/login — a Server Component can't clear the
  // session cookie itself, and redirecting there while it's still set
  // hits (auth)/layout.tsx's own "already authenticated? bounce back
  // to /" check, producing a genuine infinite redirect loop (found via
  // Playwright, not by inspection — see that route's comment).
  const record = await db.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });
  if (!record) {
    redirect("/auth/login");
  }
  if (record.status !== "ACTIVE") {
    redirect(`/api/auth/force-signout?status=${record.status.toLowerCase()}`);
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

  const membership = await resolveActiveMembership(user.id);

  if (!membership) {
    redirect("/create-company");
  }
  if (membership.company.status !== "ACTIVE") {
    redirect(`/api/auth/force-signout?status=company_${membership.company.status.toLowerCase()}`);
  }

  return { user, company: membership.company, role: membership.role };
});

// Platform-level admin gate for /admin routes — deliberately separate
// from requireCompany()'s company-membership boundary, since an admin's
// authority isn't scoped to any one company (an admin may have no
// company membership at all). Redirects to the app's normal home
// rather than /auth/login for a signed-in non-admin, since "you're
// logged in but not allowed here" is a different situation from "you're
// not logged in at all" — matching requireCompany()'s own redirect for
// a signed-in user with no company.
export const requireAdmin = cache(async function requireAdmin() {
  const user = await requireUser();

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { adminRole: true },
  });
  if (!record?.adminRole) {
    redirect("/");
  }

  return { user, adminRole: record.adminRole };
});

export const requireSuperAdmin = cache(async function requireSuperAdmin() {
  const admin = await requireAdmin();
  if (admin.adminRole !== "SUPER_ADMIN") {
    redirect("/admin");
  }
  return admin;
});
