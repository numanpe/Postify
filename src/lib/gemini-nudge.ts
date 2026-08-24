import "server-only";

import { db } from "@/lib/db";

const NUDGE_THRESHOLD = 3;

// Heuristic, not a stored per-generation flag: a company with no
// OpenAI/Anthropic/Gemini text credential has necessarily generated
// everything via the free template provider so far (BYOK wasn't
// available to it), so total posters+videos is an honest proxy for
// "template generations" without a schema change tagging every
// individual generation's provider.
export async function shouldShowGeminiNudge(companyId: string): Promise<boolean> {
  const [credential, posterCount, videoCount] = await Promise.all([
    db.providerCredential.findFirst({
      where: { companyId, provider: { in: ["OPENAI", "ANTHROPIC", "GEMINI"] } },
      select: { id: true },
    }),
    db.poster.count({ where: { companyId } }),
    db.video.count({ where: { companyId } }),
  ]);

  if (credential) return false;
  return posterCount + videoCount >= NUDGE_THRESHOLD;
}
