import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { TextProvider } from "./types";
import { OpenAITextProvider } from "./openai-provider";
import { AnthropicTextProvider } from "./anthropic-provider";
import { GeminiTextProvider } from "./gemini-provider";
import { resolveSharedOrTemplateTextProvider } from "./shared-pool";
import { withDeletionAvoidance } from "@/lib/creative-dna/deletion-avoidance";
import { findSharedProviderCredential } from "../shared-provider-credential";
import { logProviderFallback, extractFailureReason, type FallbackInfo } from "../fallback-log";
import type { AiProviderKind, ProviderCredential, SharedProviderCredential } from "@prisma/client";

const TEXT_PROVIDERS: AiProviderKind[] = ["OPENAI", "ANTHROPIC", "GEMINI"];

function buildTextProvider(provider: AiProviderKind, apiKey: string): TextProvider {
  switch (provider) {
    case "OPENAI":
      return new OpenAITextProvider(apiKey);
    case "ANTHROPIC":
      return new AnthropicTextProvider(apiKey);
    default:
      return new GeminiTextProvider(apiKey);
  }
}

// Real runtime-failure fallback (not just "no key configured", which
// buildCandidates below already resolves before this ever runs): tries
// each candidate provider in order, logging every hop via
// fallback-log.ts, and only lets an error escape once the LAST
// candidate has also failed — that's a genuine full-chain exhaustion,
// a real error the user still needs to see (Part 2.2), never an
// infinite retry or a silent hang. `any` is scoped to this one bind —
// TextProvider's methods share a uniform per-key shape at runtime, but
// expressing "the same key across a heterogeneous list of objects
// satisfying an interface" doesn't type cleanly without it.
async function callWithFallback<Args extends unknown[], R extends { providerName: string; fallbackFrom?: FallbackInfo[] }>(
  candidates: { label: string; provider: TextProvider }[],
  companyId: string,
  methodName: keyof TextProvider,
  args: Args,
): Promise<R> {
  const fallbackFrom: FallbackInfo[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const { label, provider } = candidates[i];
    try {
      const method = (provider[methodName] as any).bind(provider);
      const result: R = await method(...args);
      return fallbackFrom.length > 0 ? { ...result, fallbackFrom } : result;
    } catch (error) {
      const isLast = i === candidates.length - 1;
      const reason = extractFailureReason(error);
      await logProviderFallback({
        companyId,
        capability: "TEXT",
        method: methodName,
        fromProvider: label,
        toProvider: isLast ? null : candidates[i + 1].label,
        reason,
      });
      fallbackFrom.push({ fromProvider: label, reason });
      if (isLast) throw error;
    }
  }
  // Unreachable: buildTextProviderChain always supplies at least one
  // candidate (the free-tier tier never throws its constructor).
  throw new Error("Text provider fallback chain had no candidates.");
}

function wireTextProvider(candidates: { label: string; provider: TextProvider }[], companyId: string): TextProvider {
  const methodNames: (keyof TextProvider)[] = [
    "generateCaption",
    "generateScript",
    "generateCampaignBrief",
    "expandBackgroundPrompt",
    "summarizeBusinessContext",
    "clarifyTopic",
  ];
  const wired = {} as TextProvider;
  for (const methodName of methodNames) {
    (wired as any)[methodName] = (...args: unknown[]) =>
      callWithFallback(candidates, companyId, methodName, args as never);
  }
  return { ...wired, name: candidates[0].provider.name };
}

// The two-click rule: callers never choose a provider, they just ask
// for "the" provider for a company. BYOK wins when configured; the free
// template is the always-available fallback for "nothing configured".
// Real, separate concern this resolver now also handles: a configured
// provider that FAILS AT RUNTIME (bad response, malformed JSON, rate
// limit, model retirement — not just "unconfigured") now falls through
// to the next real option instead of hard-stopping the whole
// generation — see callWithFallback above. This is a deliberate change
// from this file's own former contract ("never a silent fallback from
// a BYOK failure, only from BYOK being unconfigured in the first
// place") — the 2026-08-31 Gemini model-retirement incident showed a
// single provider's runtime failure fully blocking generation for
// every company on that provider, with no graceful degradation. The
// final tier (free template) never throws, so the whole chain still
// always resolves to *something* real — never a fake success, per
// CLAUDE.md's own rule, since a genuine full-chain exhaustion still
// throws a real error (see callWithFallback's isLast branch).
export async function getTextProviderForCompany(companyId: string): Promise<TextProvider> {
  // Real bug fixed here (unchanged from before): ProviderCredential is
  // one shared table across every AiProviderKind — filtering to only
  // the text-capable providers keeps a voice-only credential from ever
  // being picked up here.
  const ownCredentials: ProviderCredential[] = await db.providerCredential.findMany({
    where: { companyId, provider: { in: TEXT_PROVIDERS } },
    orderBy: { createdAt: "asc" },
  });

  // Company-owned credentials always come first (existing precedence,
  // unchanged) — the shared (user-level) credential only ever fills in
  // for a provider the company hasn't already configured its own key
  // for, so it's a genuine additional option, never a redundant retry
  // of a provider already covered above.
  const coveredProviders = new Set(ownCredentials.map((c) => c.provider));
  const remainingProviders = TEXT_PROVIDERS.filter((p) => !coveredProviders.has(p));
  const sharedCredential: SharedProviderCredential | null =
    remainingProviders.length > 0 ? await findSharedProviderCredential(companyId, remainingProviders, "asc") : null;

  const byokCandidates = [...ownCredentials, ...(sharedCredential ? [sharedCredential] : [])].map((c) => {
    const provider = buildTextProvider(c.provider, decryptSecret(c.encryptedKey));
    return { label: provider.name, provider };
  });

  // Terminal tier: Free AI shared pool, already itself falling back to
  // the deterministic template on ANY failure (shared-pool.ts's
  // tryShared) — never throws, so it's always safe as the last
  // candidate in the chain below.
  const freeTierProvider = await resolveSharedOrTemplateTextProvider();
  const candidates = [...byokCandidates, { label: freeTierProvider.name, provider: freeTierProvider }];

  const base = wireTextProvider(candidates, companyId);

  // Every caller of this resolver automatically gets the "never
  // regenerate an exact deleted output again" rule (Part 1.1) — no
  // individual call site needs to know this exists.
  return withDeletionAvoidance(base, companyId);
}
