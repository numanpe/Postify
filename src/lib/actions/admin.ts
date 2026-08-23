"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const VALID_STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
type CompanyStatus = (typeof VALID_STATUSES)[number];

// Company-level ban/suspend/reactivate (Part A1) — the admin panel's
// list is a company list, so its actions operate on Company.status.
// Re-checks requireAdmin() itself rather than trusting the page-level
// gate, matching every other server action in this codebase (a Server
// Action is directly callable regardless of which page rendered the
// button that triggered it).
export async function setCompanyStatus(companyId: string, status: CompanyStatus): Promise<void> {
  const { user } = await requireAdmin();

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { status: true, name: true },
  });
  if (!company) {
    throw new Error("Company not found.");
  }

  await db.$transaction([
    db.company.update({ where: { id: companyId }, data: { status } }),
    db.adminActionLog.create({
      data: {
        actorId: user.id,
        action: `SET_COMPANY_STATUS_${status}`,
        targetType: "Company",
        targetId: companyId,
        metadata: { from: company.status, to: status, companyName: company.name },
      },
    }),
  ]);

  revalidatePath("/admin");
}
