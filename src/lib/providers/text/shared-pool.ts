import "server-only";

import { db } from "@/lib/db";
import type {
  TextProvider,
  GenerateReplyInput,
  GenerateReplyOutput,
  GenerateCaptionInput,
  GenerateCaptionOutput,
  GenerateScriptInput,
  GenerateScriptOutput,
  GenerateCampaignBriefInput,
  GenerateCampaignBriefOutput,
  ExpandBackgroundPromptInput,
  ExpandBackgroundPromptOutput,
  SummarizeBusinessContextInput,
  SummarizeBusinessContextOutput,
  ClarifyTopicInput,
  ClarifyTopicOutput,
  GeneratePosterHighlightsInput,
  GeneratePosterHighlightsOutput,
  EditPosterInput,
  EditPosterOutput,
} from "./types";
import { GeminiTextProvider, GeminiQuotaExhaustedError } from "./gemini-provider";
import { TemplateTextProvider } from "./template-provider";

// Platform-held, zero-setup "Free AI" text pool — real, verified free
// tier (Google's own terms: "Unpaid Services", no billing account
// needed), distinct from the per-company BYOK Gemini credential.
// SHARED_POOL_PROVIDER stays "GEMINI" (the same AiProviderKind value
// BYOK Gemini uses) since this is genuinely the same vendor/quota
// family for SharedAiUsage's bookkeeping — it's the *key* that's
// platform-held here, not a different provider identity.
const SHARED_POOL_PROVIDER = "GEMINI" as const;

// Exported so topic-guard.ts's free-tier detection can recognize this
// name too — see resolveSharedOrTemplateTextProvider's clarifyTopic
// comment for why the shared pool doesn't get real clarification
// capability, which means it needs the same "block and ask" treatment
// topic-guard.ts already gives the plain template.
export const SHARED_POOL_PROVIDER_NAME = "Free AI";

function todayUtcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getPlatformGeminiApiKey(): string | null {
  return process.env.PLATFORM_GEMINI_API_KEY ?? null;
}

// Real, measured evidence (2026-09-01): a real 429 at 10:21 UTC had
// fully recovered by 12:16 UTC — well under 2 hours, not a full day.
// Locking the shared pool out until UTC midnight on every 429 (the
// original behavior) was needlessly pessimistic and would have kept
// routing real companies to the template fallback for hours after
// Google's real limiting condition had already cleared. Neither
// Gemini's public rate-limit docs nor its error-format docs document a
// retry-after hint or a way to distinguish a short burst limit from
// the real daily cap in the 429 body, so rather than guess at Google's
// exact error shape, this retries after a short, fixed cooldown instead
// of trusting a fixed calendar boundary — same "only trust a real
// response" principle already used for exhaustion, now applied to
// recovery too (classic half-open circuit-breaker: one real trial
// request allowed through once the cooldown elapses; a real success
// clears the breaker immediately, a real failure re-arms it).
const EXHAUSTION_COOLDOWN_MS = 15 * 60 * 1000;

// Real circuit breaker (Part 4.2): checked before every attempt so a
// pool already known-exhausted (from a real 429 seen recently) doesn't
// keep retrying pointlessly against Google. Never guessed from our own
// successCount — the real daily limit isn't a stable, reliably known
// number (verified directly against Google's docs — see
// gemini-provider.ts's MODEL comment), so the only trustworthy signal
// is a real 429 (to open the breaker) or a real 200 (to close it) —
// see EXHAUSTION_COOLDOWN_MS's doc comment for why this is now a
// cooldown-and-retry rather than a same-day lock.
export async function isSharedPoolExhaustedToday(): Promise<boolean> {
  const row = await db.sharedAiUsage.findUnique({
    where: { provider_date: { provider: SHARED_POOL_PROVIDER, date: todayUtcDateOnly() } },
  });
  if (!row?.exhaustedAt) return false;
  return Date.now() - row.exhaustedAt.getTime() < EXHAUSTION_COOLDOWN_MS;
}

// For the calm, expected-feeling UI notice (Part 5.3) — only true when
// the pool is genuinely configured AND genuinely exhausted for today,
// never when it was simply never set up (that's not an "exhausted"
// state, it's a "doesn't exist" state, and showing an exhaustion
// message for a feature that was never enabled would be dishonest).
// Only relevant for companies with no BYOK text credential — a company
// with its own key was never using this pool to begin with.
export async function shouldShowSharedPoolExhaustedNotice(companyId: string): Promise<boolean> {
  if (!getPlatformGeminiApiKey()) return false;

  const credential = await db.providerCredential.findFirst({
    where: { companyId, provider: { in: ["OPENAI", "ANTHROPIC", "GEMINI"] } },
    select: { id: true },
  });
  if (credential) return false;

  return isSharedPoolExhaustedToday();
}

async function recordSharedPoolSuccess(): Promise<void> {
  const date = todayUtcDateOnly();
  // A real success is the strongest possible recovery signal — clears
  // exhaustedAt immediately (rather than waiting for the cooldown to
  // elapse again on its own) so the half-open trial this success came
  // from genuinely closes the breaker, not just quietly ticks past it.
  await db.sharedAiUsage.upsert({
    where: { provider_date: { provider: SHARED_POOL_PROVIDER, date } },
    create: { provider: SHARED_POOL_PROVIDER, date, successCount: 1 },
    update: { successCount: { increment: 1 }, exhaustedAt: null },
  });
}

async function recordSharedPoolExhaustion(): Promise<void> {
  const date = todayUtcDateOnly();
  // Always refreshes exhaustedAt to now, unlike the old "only set if
  // null" guard — that's what turns this into real backoff: a single
  // 429 opens the breaker for one EXHAUSTION_COOLDOWN_MS window, but if
  // the half-open trial after that window also 429s, this pushes the
  // window out again rather than letting every subsequent call retry
  // Google for nothing once the original cooldown had simply ticked
  // past. Only a real success (recordSharedPoolSuccess) closes it early.
  await db.sharedAiUsage.upsert({
    where: { provider_date: { provider: SHARED_POOL_PROVIDER, date } },
    create: { provider: SHARED_POOL_PROVIDER, date, exhaustedAt: new Date() },
    update: { exhaustedAt: new Date() },
  });
}

// Reports as "Free AI" rather than GeminiTextProvider's default
// "Google Gemini" — generated content must honestly distinguish "your
// own key" (BYOK, Settings-configured) from "the shared platform
// pool" (zero-setup, first-come-first-serve) to the company, not
// present both identically.
class SharedGeminiTextProvider extends GeminiTextProvider {
  constructor(apiKey: string) {
    super(apiKey);
    this.name = SHARED_POOL_PROVIDER_NAME;
  }
}

function tryShared<Args extends unknown[], R>(
  method: ((...args: Args) => Promise<R>) | undefined,
  fallback: (...args: Args) => Promise<R>,
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    if (!method) return fallback(...args);
    try {
      const result = await method(...args);
      await recordSharedPoolSuccess();
      return result;
    } catch (error) {
      if (error instanceof GeminiQuotaExhaustedError) {
        await recordSharedPoolExhaustion();
      }
      // ANY failure (exhaustion, network blip, malformed response)
      // falls back to the template for this one call — the shared
      // pool is a transparent bonus layer under the free tier, never
      // something a company explicitly opted into, so a failure here
      // must never surface as a visible error the way a BYOK failure
      // correctly does. This is the "never hard-fail free tier"
      // standard already established for every other free-tier path.
      return fallback(...args);
    }
  };
}

// The free-tier resolver (getTextProviderForCompany in resolver.ts)
// calls this only when a company has no BYOK text credential. Tries
// the platform-held shared Gemini pool first (if configured and not
// already known-exhausted today), falling back to the deterministic
// template per-method on any failure.
export async function resolveSharedOrTemplateTextProvider(): Promise<TextProvider> {
  const template = new TemplateTextProvider();
  const apiKey = getPlatformGeminiApiKey();

  if (!apiKey || (await isSharedPoolExhaustedToday())) {
    return template;
  }

  const shared = new SharedGeminiTextProvider(apiKey);

  return {
    name: shared.name,
    generateReply: tryShared<[GenerateReplyInput], GenerateReplyOutput>(
      shared.generateReply.bind(shared),
      template.generateReply.bind(template),
    ),
    generateCaption: tryShared<[GenerateCaptionInput], GenerateCaptionOutput>(
      shared.generateCaption.bind(shared),
      template.generateCaption.bind(template),
    ),
    generateScript: tryShared<[GenerateScriptInput], GenerateScriptOutput>(
      shared.generateScript.bind(shared),
      template.generateScript.bind(template),
    ),
    generateCampaignBrief: tryShared<[GenerateCampaignBriefInput], GenerateCampaignBriefOutput>(
      shared.generateCampaignBrief.bind(shared),
      template.generateCampaignBrief.bind(template),
    ),
    expandBackgroundPrompt: tryShared<[ExpandBackgroundPromptInput], ExpandBackgroundPromptOutput>(
      shared.expandBackgroundPrompt.bind(shared),
      template.expandBackgroundPrompt.bind(template),
    ),
    summarizeBusinessContext: tryShared<[SummarizeBusinessContextInput], SummarizeBusinessContextOutput>(
      shared.summarizeBusinessContext.bind(shared),
      template.summarizeBusinessContext.bind(template),
    ),
    // clarifyTopic deliberately NOT routed through the shared pool —
    // topic-guard.ts's free-tier detection (FREE_TEXT_PROVIDER_NAME
    // check) identifies the free tier by provider name to decide
    // "block and ask" vs. "BYOK reinterprets" behavior; giving free-
    // tier companies a real clarifyTopic() here would need that
    // detection reworked too, out of scope for this pass. Template's
    // own clarifyTopic() (always returns null) is correct and
    // unchanged either way.
    clarifyTopic: template.clarifyTopic.bind(template),
    generatePosterHighlights: tryShared<[GeneratePosterHighlightsInput], GeneratePosterHighlightsOutput>(
      shared.generatePosterHighlights.bind(shared),
      template.generatePosterHighlights.bind(template),
    ),
    // NOT tryShared — real, confirmed-live bug (2026-09-04): every other
    // method here silently produces alternate CONTENT on fallback, so a
    // generic catch-all is fine for them. editPosterSpec is the one
    // method with a user-FACING "why is this unavailable" string, and
    // template.editPosterSpec()'s message ("needs a connected AI
    // provider — add one in Settings") is actively misleading when we're
    // in this catch branch specifically — that only happens because a
    // real shared-pool key WAS configured and genuinely attempted (see
    // resolveSharedOrTemplateTextProvider's own apiKey/exhaustion check
    // above this object literal), not because no provider exists. A real
    // root cause of exactly this (editPosterSpec's Gemini call truncating
    // on an undersized token budget) was found and fixed separately in
    // gemini-provider.ts; this fixes the SEPARATE, still-real problem
    // that ANY failure here — that one, a genuine exhaustion, or a future
    // transient error — would keep showing the same "no provider"
    // message even after that fix, since a temporary failure is still a
    // real possibility this wording needs to describe honestly.
    editPosterSpec: async (...args: Parameters<TextProvider["editPosterSpec"]>) => {
      try {
        const result = await shared.editPosterSpec(...args);
        await recordSharedPoolSuccess();
        return result;
      } catch (error) {
        if (error instanceof GeminiQuotaExhaustedError) {
          await recordSharedPoolExhaustion();
        }
        const fallbackResult = await template.editPosterSpec();
        return {
          ...fallbackResult,
          unavailableReason:
            "Free AI is temporarily unavailable for editing right now — try again shortly, or add your own key in Settings for guaranteed access.",
        };
      }
    },
  };
}
