"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";

// The real "turn this back on" path the digest-unsubscribe page's own
// copy promises ("you can turn this back on later from Settings") —
// the unsubscribe link only ever turns it off (see
// digest-unsubscribe.ts), this is the other real half of that same
// on/off preference (CLAUDE.md: never promise a control that doesn't
// exist).
export async function updateWeeklyDigestPreference(formData: FormData): Promise<void> {
  const { company } = await requireCompany();

  await db.company.update({
    where: { id: company.id },
    data: { weeklyDigestEnabled: formData.get("weeklyDigestEnabled") === "on" },
  });

  revalidatePath("/settings");
}
