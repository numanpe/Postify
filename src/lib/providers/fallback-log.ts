import "server-only";

import { db } from "@/lib/db";

// Attached to a successful generation's output (see each capability's
// GenerateXOutput types) whenever it didn't come from the first-choice
// provider — the real data behind Part 3's honest UI labeling. One
// entry per failed hop, in order, so a company that fell back twice
// (their own key, then a second saved key, before finally landing on
// Free AI) sees the real full path, not just the last failure.
export interface FallbackInfo {
  fromProvider: string;
  reason: string;
}

// Real, durable record of the runtime-failure fallback chain (Part 4)
// actually kicking in, so a provider that's failing frequently is
// discoverable from the admin panel — not just absorbed silently
// forever the way an unlogged catch-and-continue would be. Console
// logging alone (already used everywhere else in this app, e.g.
// shared-image-pool.ts) is real but ephemeral; this is the same signal
// made queryable and durable.
//
// Never allowed to break the actual generation it's reporting on — a
// logging failure (DB hiccup, etc.) is swallowed here, not rethrown,
// since losing a diagnostic record is a real but much smaller problem
// than losing the user's generation over it.
export async function logProviderFallback(params: {
  companyId: string;
  capability: "TEXT" | "VOICE" | "IMAGE";
  method: string;
  fromProvider: string;
  toProvider: string | null;
  reason: string;
}): Promise<void> {
  const direction = params.toProvider ? `falling back to ${params.toProvider}` : "NO further option succeeded";
  console.warn(
    `[fallback:${params.capability}.${params.method}] company=${params.companyId} ${params.fromProvider} failed (${params.reason}) — ${direction}`,
  );

  await db.providerFallbackEvent
    .create({
      data: {
        companyId: params.companyId,
        capability: params.capability,
        method: params.method,
        fromProvider: params.fromProvider,
        toProvider: params.toProvider,
        reason: params.reason.slice(0, 500),
      },
    })
    .catch((error) => {
      console.error("[fallback-log] Failed to persist ProviderFallbackEvent (non-fatal):", error);
    });
}

// Shared classification: is this the message text a real user should
// ever see (a config problem only they can fix — no key, wrong key),
// or a genuine runtime failure worth falling back on? Reused by every
// capability's chain so "should I try the next candidate" is answered
// consistently rather than each resolver guessing its own rule.
//
// Deliberately broad on purpose — this app's own priority order ranks
// reliability above raw precision here (CLAUDE.md: "quality >
// reliability > simplicity > performance > security"), and per Part 1's
// own spec, "bad response, malformed JSON, API error, rate limit, model
// retirement" are ALL meant to trigger fallback now, a deliberate
// change from the older "a configured BYOK failure must always surface
// directly" rule (still true for the *last* option in a chain — see
// each resolver's own final-attempt handling).
export function extractFailureReason(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
