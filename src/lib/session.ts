import "server-only";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login");
  }
  return session.user;
}

// The multi-tenant boundary: resolves the caller's company strictly from
// their CompanyMember row, never from a client-supplied companyId. Every
// company-scoped data access in the app should go through this (or a
// query that includes an equivalent membership check), per CLAUDE.md's
// data-layer isolation requirement.
export async function requireCompany() {
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
}
