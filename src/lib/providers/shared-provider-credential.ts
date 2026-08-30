import "server-only";

import { db } from "@/lib/db";
import type { AiProviderKind, SharedProviderCredential } from "@prisma/client";

// Company-specific ProviderCredential rows always win — every resolver
// (text/voice/image) checks that table first and only calls this as a
// fallback. Looks up every CompanyMember of the company rather than
// assuming a single owner: team support (multiple human members on one
// company) is explicitly deferred elsewhere in this app, but if that
// ever lands, this must keep resolving to exactly the set of users who
// are real members of this company — never a global lookup, and never
// a different user's shared key. That's the hard security boundary
// this table exists under.
export async function findSharedProviderCredential(
  companyId: string,
  providers: AiProviderKind[],
  orderBy: "asc" | "desc" = "asc",
): Promise<SharedProviderCredential | null> {
  const memberships = await db.companyMember.findMany({
    where: { companyId },
    select: { userId: true },
  });
  if (memberships.length === 0) return null;

  return db.sharedProviderCredential.findFirst({
    where: {
      userId: { in: memberships.map((m) => m.userId) },
      provider: { in: providers },
    },
    orderBy: { createdAt: orderBy },
  });
}

// Real, not guessed, impact list for the Settings page's "stop sharing"
// confirmation — every OTHER company this user belongs to that has no
// company-specific override for this provider, i.e. every company that
// is actually relying on the shared key today and would lose access
// immediately if it were unshared. Computed server-side in the Settings
// page itself (a Server Component, same pattern as its other data
// fetches) rather than as a client-triggered lookup.
export async function getCompaniesRelyingOnSharedCredential(
  userId: string,
  provider: AiProviderKind,
  currentCompanyId: string,
): Promise<{ companyId: string; companyName: string }[]> {
  const otherMemberships = await db.companyMember.findMany({
    where: { userId, companyId: { not: currentCompanyId } },
    select: { companyId: true, company: { select: { name: true } } },
  });
  if (otherMemberships.length === 0) return [];

  const overrides = await db.providerCredential.findMany({
    where: { companyId: { in: otherMemberships.map((m) => m.companyId) }, provider },
    select: { companyId: true },
  });
  const overriddenIds = new Set(overrides.map((o) => o.companyId));

  return otherMemberships
    .filter((m) => !overriddenIds.has(m.companyId))
    .map((m) => ({ companyId: m.companyId, companyName: m.company.name }));
}
