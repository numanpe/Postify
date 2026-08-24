import "server-only";

import { db } from "@/lib/db";
import type {
  TextProvider,
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

// Real circuit breaker (Part 4.2): checked before every attempt so a
// day already known-exhausted (from a real 429 seen earlier today)
// doesn't keep retrying pointlessly against Google. Never guessed from
// our own successCount — the real daily limit isn't a stable, reliably
// known number (verified directly against Google's docs — see
// gemini-provider.ts's MODEL comment), so the only trustworthy signal
// is a real 429 response.
export async function isSharedPoolExhaustedToday(): Promise<boolean> {
  const row = await db.sharedAiUsage.findUnique({
    where: { provider_date: { provider: SHARED_POOL_PROVIDER, date: todayUtcDateOnly() } },
  });
  return Boolean(row?.exhaustedAt);
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
  await db.sharedAiUsage.upsert({
    where: { provider_date: { provider: SHARED_POOL_PROVIDER, date } },
    create: { provider: SHARED_POOL_PROVIDER, date, successCount: 1 },
    update: { successCount: { increment: 1 } },
  });
}

async function recordSharedPoolExhaustion(): Promise<void> {
  const date = todayUtcDateOnly();
  // Only sets exhaustedAt if not already set — avoids repeatedly
  // bumping the timestamp on every subsequent 429 once today's already
  // marked exhausted.
  const updated = await db.sharedAiUsage.updateMany({
    where: { provider: SHARED_POOL_PROVIDER, date, exhaustedAt: null },
    data: { exhaustedAt: new Date() },
  });
  if (updated.count === 0) {
    // Either already exhausted (fine, no-op below) or no row exists
    // yet for today at all — create it. The `update: {}` no-op covers
    // the rare race where another request created the row between the
    // updateMany above and this upsert.
    await db.sharedAiUsage.upsert({
      where: { provider_date: { provider: SHARED_POOL_PROVIDER, date } },
      create: { provider: SHARED_POOL_PROVIDER, date, exhaustedAt: new Date() },
      update: {},
    });
  }
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
  };
}
