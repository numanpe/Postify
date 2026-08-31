import "server-only";

import type {
  TextProvider,
  GenerateCaptionInput,
  GenerateCaptionOutput,
  GenerateScriptInput,
  GenerateScriptOutput,
  VideoScriptSections,
  GenerateCampaignBriefInput,
  GenerateCampaignBriefOutput,
  ExpandBackgroundPromptInput,
  ExpandBackgroundPromptOutput,
  SummarizeBusinessContextInput,
  SummarizeBusinessContextOutput,
  ClarifyTopicInput,
  ClarifyTopicOutput,
} from "./types";
import { ProviderError } from "./types";
import {
  buildCaptionPrompt,
  buildScriptPrompt,
  buildCampaignBriefPrompt,
  parseCampaignBriefResponse,
  buildBackgroundExpansionPrompt,
  parseExpandedPromptResponse,
  buildBusinessContextPrompt,
  parseBusinessContextResponse,
  buildClarifyTopicPrompt,
  parseClarifyTopicResponse,
} from "./prompt";
import { fetchWithRetry } from "../http";
import { GEMINI_TEXT_MODEL } from "../gemini-models";

// Verified against Google's real official docs (ai.google.dev) before
// writing this, same discipline as the Gemini image provider.
//
// Uses the older v1beta/models/{model}:generateContent endpoint, NOT
// the newer Interactions API src/lib/providers/image/gemini-image-provider.ts
// uses — a deliberate difference, not an oversight. Google's own
// migration guide states generateContent "remains fully supported"
// with no sunset date, while only recommending Interactions for *new*
// integrations; unlike image generation (where generateContent doesn't
// document image-model support at all, forcing the newer API),
// generateContent fully supports plain text with a well-documented
// JSON-mode (responseMimeType). This app's own prompt.ts already
// parses/validates raw JSON text itself (parseCampaignBriefResponse
// etc.) rather than relying on a provider's schema-validated
// structured output — that's exactly generateContent's json mode, and
// avoids depending on the Interactions API's less-documented
// response_format schema shape for no real benefit here.
const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Real prod outage fixed 2026-08-31: gemini-2.5-flash started returning
// a real 404 ("This model ... is no longer available to new users")
// for BYOK companies creating a fresh Google API key — a narrower
// "new-user-only" restriction that Google's deprecations page doesn't
// list (it shows no shutdown date for gemini-2.5-flash even now), so
// don't treat that page as the sole source of truth next time. Model ID
// now lives in gemini-models.ts (GEMINI_TEXT_MODEL) — see that file's
// comment for the full verification trail and re-check cadence. The
// free tier's exact daily request quota is still NOT a stable number to
// hardcode anywhere in this app — real 2026 sources disagree by an
// order of magnitude, and Google's own docs no longer publish a fixed
// table, just "check AI Studio." Settings/onboarding copy must not
// quote a specific figure.

interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
  finishReason?: string;
}
interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

const SCRIPT_SECTION_KEYS: (keyof VideoScriptSections)[] = ["hook", "context", "value", "message", "cta"];

// Cheap insurance, same real-world quirk Anthropic's provider already
// guards against — a model wrapping JSON in a ```json fence despite
// responseMimeType being set to application/json.
function stripCodeFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1] : text;
}

// Distinguishable from a generic ProviderError so callers can react
// specifically to real quota exhaustion — src/lib/providers/text/
// shared-pool.ts's circuit breaker needs this to know when to mark the
// platform-held pool exhausted for the rest of the day, vs. a
// transient/unrelated failure it shouldn't treat the same way.
export class GeminiQuotaExhaustedError extends ProviderError {}

export class GeminiTextProvider implements TextProvider {
  // Not `readonly` with a fixed literal — src/lib/providers/text/
  // shared-pool.ts subclasses this with a different name ("Free AI")
  // for the platform-held pool, so generated content's providerName
  // honestly distinguishes "your own key" from "the shared free pool"
  // rather than both reporting "Google Gemini" identically.
  name = "Google Gemini";

  constructor(private readonly apiKey: string) {}

  private async generateContent(
    system: string,
    user: string,
    options: { jsonMode?: boolean; maxTokens?: number } = {},
  ): Promise<{ content: string; estimatedCostUsd?: number; finishReason?: string }> {
    let response: Response;
    try {
      response = await fetchWithRetry(
        `${ENDPOINT_BASE}/${GEMINI_TEXT_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: user }] }],
            systemInstruction: { parts: [{ text: system }] },
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: options.maxTokens ?? 150,
              ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
            },
          }),
        },
      );
    } catch (error) {
      throw new ProviderError(this.name, "Could not reach Google Gemini (network error or timeout).", error);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Same real, confirmed-live auth-failure shape as
      // gemini-image-provider.ts — Google's API-key auth is shared
      // across its surfaces, not endpoint-specific.
      if (response.status === 401 || response.status === 403 || /api key not valid/i.test(body)) {
        throw new ProviderError(this.name, "Google rejected this request — check the API key in Settings.");
      }
      if (response.status === 429) {
        throw new GeminiQuotaExhaustedError(
          this.name,
          "Google's free-tier rate limit was reached for this request. Try again shortly, or check your quota in Google AI Studio.",
        );
      }
      throw new ProviderError(
        this.name,
        `Google Gemini request failed (${response.status}). ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      throw new ProviderError(this.name, "Google Gemini returned an empty response.");
    }

    // Free tier by default (the whole point of Part 3's pitch) — see
    // this file's model-constant comment above for why no specific
    // quota/cost figure is quoted anywhere in this app's UI.
    return { content: stripCodeFence(text), estimatedCostUsd: 0, finishReason: candidate?.finishReason };
  }

  // Real diagnostic, not a guess: a parse failure with zero visibility
  // into what Gemini actually sent back is exactly what made the
  // 2026-08-31 gemini-3.6-flash migration issue hard to pin down —
  // confirmed live 2026-08-31 to also hit expandBackgroundPrompt (a
  // real "Graze Market" company's poster generation), not just
  // generateScript, so this is shared across every JSON-mode method
  // rather than a one-off fix. finishReason === "MAX_TOKENS"
  // specifically means the response was cut off mid-JSON by
  // maxOutputTokens; content logged raw (no redaction needed — this is
  // generated marketing copy, never a secret) but capped to keep log
  // volume sane. finishReason is folded into the thrown message itself
  // (not just the console.error) so it's captured durably too, via the
  // fallback chain's ProviderFallbackEvent log (fallback-log.ts) — real
  // visibility that survives past Vercel's short-lived log retention,
  // not dependent on catching a live --follow stream at the exact right
  // moment.
  private parseJsonOrThrow(methodLabel: string, userFacingLabel: string, content: string, finishReason?: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error(
        `[GeminiTextProvider.${methodLabel}] JSON.parse failed — finishReason=${finishReason ?? "(none)"}, contentLength=${content.length}, content=${content.slice(0, 2000)}`,
      );
      throw new ProviderError(
        this.name,
        `Google Gemini returned malformed ${userFacingLabel} JSON (finishReason=${finishReason ?? "none"}, length=${content.length}).`,
        error,
      );
    }
  }

  async generateCaption({ context, topic }: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    const { system, user } = buildCaptionPrompt(context, topic);
    const { content, estimatedCostUsd } = await this.generateContent(system, user);
    return { text: content, providerName: this.name, model: GEMINI_TEXT_MODEL, estimatedCostUsd };
  }

  async generateScript({ context, topic }: GenerateScriptInput): Promise<GenerateScriptOutput> {
    const { system, user } = buildScriptPrompt(context, topic);
    const { content, estimatedCostUsd, finishReason } = await this.generateContent(system, user, {
      jsonMode: true,
      maxTokens: 500,
    });

    const parsed = this.parseJsonOrThrow("generateScript", "script", content, finishReason);

    if (typeof parsed !== "object" || parsed === null) {
      throw new ProviderError(this.name, "Google Gemini returned an unexpected script format.");
    }
    const record = parsed as Record<string, unknown>;
    for (const key of SCRIPT_SECTION_KEYS) {
      if (typeof record[key] !== "string" || !record[key]) {
        throw new ProviderError(this.name, `Google Gemini's script response is missing "${key}".`);
      }
    }

    const script = record as unknown as VideoScriptSections;
    return { script, providerName: this.name, model: GEMINI_TEXT_MODEL, estimatedCostUsd };
  }

  async generateCampaignBrief(input: GenerateCampaignBriefInput): Promise<GenerateCampaignBriefOutput> {
    const { system, user } = buildCampaignBriefPrompt({
      context: input.context,
      objective: input.objective,
      itemCount: input.itemCount,
      scheduledDates: input.scheduledDates,
      connectedPlatforms: input.connectedPlatforms,
    });
    const { content, estimatedCostUsd, finishReason } = await this.generateContent(system, user, {
      jsonMode: true,
      maxTokens: 1500,
    });

    const parsed = this.parseJsonOrThrow("generateCampaignBrief", "campaign brief", content, finishReason);

    const brief = parseCampaignBriefResponse(parsed, this.name, input.itemCount, input.connectedPlatforms);
    return { ...brief, model: GEMINI_TEXT_MODEL, estimatedCostUsd };
  }

  async expandBackgroundPrompt(input: ExpandBackgroundPromptInput): Promise<ExpandBackgroundPromptOutput> {
    const { system, user } = buildBackgroundExpansionPrompt(input);
    const { content, finishReason } = await this.generateContent(system, user, { jsonMode: true, maxTokens: 400 });

    const parsed = this.parseJsonOrThrow("expandBackgroundPrompt", "background-prompt", content, finishReason);

    return parseExpandedPromptResponse(parsed, this.name);
  }

  async summarizeBusinessContext(input: SummarizeBusinessContextInput): Promise<SummarizeBusinessContextOutput> {
    const { system, user } = buildBusinessContextPrompt(input);
    const { content, finishReason } = await this.generateContent(system, user, { jsonMode: true, maxTokens: 400 });

    const parsed = this.parseJsonOrThrow("summarizeBusinessContext", "business-context", content, finishReason);

    const result = parseBusinessContextResponse(parsed, this.name);
    return { ...result, providerName: this.name };
  }

  async clarifyTopic(input: ClarifyTopicInput): Promise<ClarifyTopicOutput> {
    const { system, user } = buildClarifyTopicPrompt(input);
    const { content, finishReason } = await this.generateContent(system, user, { jsonMode: true, maxTokens: 60 });

    const parsed = this.parseJsonOrThrow("clarifyTopic", "clarify-topic", content, finishReason);

    const clarifiedTopic = parseClarifyTopicResponse(parsed, this.name);
    return { clarifiedTopic, providerName: this.name };
  }
}
