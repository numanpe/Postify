"use server";

import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

export type UnsubscribeState = { status: "success" } | { status: "error"; error: string } | undefined;

// Re-verifies the token server-side inside the action itself, not just
// on the page's initial render — never trust that a hidden form field
// wasn't tampered with client-side before submit.
export async function confirmDigestUnsubscribe(
  _prevState: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  const companyId = String(formData.get("companyId") ?? "");
  const token = String(formData.get("token") ?? "");

  if (!companyId || !token || !verifyUnsubscribeToken(companyId, token)) {
    return { status: "error", error: "This unsubscribe link is invalid or has expired." };
  }

  await db.company.update({ where: { id: companyId }, data: { weeklyDigestEnabled: false } }).catch(() => {
    // Company no longer exists — nothing to unsubscribe from, but that's
    // still a real "you won't get any more of these" outcome, so it's
    // not shown as an error to a real person clicking a real old link.
  });

  return { status: "success" };
}
