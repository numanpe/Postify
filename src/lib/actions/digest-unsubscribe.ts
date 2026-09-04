"use server";

import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

export type UnsubscribeState = { status: "success" } | { status: "error"; error: string } | undefined;

// The token itself is keyed only on companyId (see unsubscribe-token.ts
// — one real "you own this company's inbox" proof, not a per-feature
// secret), so the same signed link format now serves two different
// preferences via this explicit `type` field rather than minting a
// second token scheme for what's really the same trust boundary.
export type UnsubscribeKind = "digest" | "nudge";

function isUnsubscribeKind(value: unknown): value is UnsubscribeKind {
  return value === "digest" || value === "nudge";
}

// Re-verifies the token server-side inside the action itself, not just
// on the page's initial render — never trust that a hidden form field
// wasn't tampered with client-side before submit.
export async function confirmDigestUnsubscribe(
  _prevState: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  const companyId = String(formData.get("companyId") ?? "");
  const token = String(formData.get("token") ?? "");
  const typeRaw = formData.get("type");
  const type: UnsubscribeKind = isUnsubscribeKind(typeRaw) ? typeRaw : "digest";

  if (!companyId || !token || !verifyUnsubscribeToken(companyId, token)) {
    return { status: "error", error: "This unsubscribe link is invalid or has expired." };
  }

  await db.company
    .update({
      where: { id: companyId },
      data: type === "nudge" ? { inactivityNudgeEnabled: false } : { weeklyDigestEnabled: false },
    })
    .catch(() => {
      // Company no longer exists — nothing to unsubscribe from, but that's
      // still a real "you won't get any more of these" outcome, so it's
      // not shown as an error to a real person clicking a real old link.
    });

  return { status: "success" };
}
