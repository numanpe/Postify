import "server-only";

import type {
  TextProvider,
  GenerateReplyInput,
  GenerateReplyOutput,
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
  GeneratePosterHighlightsInput,
  GeneratePosterHighlightsOutput,
  EditPosterInput,
  EditPosterOutput,
} from "./types";
import { ProviderError } from "./types";
import {
  buildReplyPrompt,
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
  buildPosterHighlightsPrompt,
  parsePosterHighlightsResponse,
  buildPosterEditPrompt,
  parsePosterEditResponse,
} from "./prompt";
import { fetchWithRetry } from "../http";
import { GEMINI_TEXT_MODEL } from "../gemini-models";
import { TEMPLATE_IDS } from "@/lib/poster/template-ids";

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

// Google's Structured Output feature (responseSchema) — constrains
// generateContent's JSON-mode output to an exact shape at the API
// level, not just via instruction text in the prompt. Verified against
// ai.google.dev's Schema reference before writing these: OBJECT/STRING/
// ARRAY types, "required", "enum", "nullable", "items", and
// "propertyOrdering" are all real, documented fields for the
// generateContent REST endpoint (the older API this file deliberately
// uses — see this file's top comment). A POSTER item's headline/
// subhead/cta vs. a VIDEO item's videoTopic are deliberately left out
// of "required" rather than modeled as a schema union — Gemini's
// documented schema subset doesn't support oneOf/conditional-required,
// and prompt.ts's parseCampaignBriefResponse already does the real
// per-assetType validation this app actually relies on.
const SCRIPT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    hook: { type: "STRING" },
    context: { type: "STRING" },
    value: { type: "STRING" },
    message: { type: "STRING" },
    cta: { type: "STRING" },
  },
  required: ["hook", "context", "value", "message", "cta"],
  propertyOrdering: ["hook", "context", "value", "message", "cta"],
};

const CAMPAIGN_BRIEF_ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    assetType: { type: "STRING", enum: ["POSTER", "VIDEO"] },
    angle: { type: "STRING" },
    headline: { type: "STRING" },
    subhead: { type: "STRING" },
    cta: { type: "STRING" },
    videoTopic: { type: "STRING" },
    captionText: { type: "STRING" },
    hashtags: { type: "ARRAY", items: { type: "STRING" } },
    suggestedPostAt: { type: "STRING" },
    targetPlatforms: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["assetType", "angle", "captionText", "hashtags", "suggestedPostAt", "targetPlatforms"],
};

const CAMPAIGN_BRIEF_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    campaignType: { type: "STRING" },
    items: { type: "ARRAY", items: CAMPAIGN_BRIEF_ITEM_SCHEMA },
  },
  required: ["campaignType", "items"],
};

const BACKGROUND_EXPANSION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    expandedVisualPrompt: { type: "STRING" },
    negativePrompt: { type: "STRING" },
    designParameters: {
      type: "OBJECT",
      properties: {
        aspectRatio: { type: "STRING" },
        colorPalette: { type: "ARRAY", items: { type: "STRING" } },
        compositionStyle: { type: "STRING", enum: ["Minimalist", "Bold Geometric", "Organic"] },
      },
      required: ["aspectRatio", "colorPalette", "compositionStyle"],
    },
  },
  required: ["expandedVisualPrompt", "negativePrompt", "designParameters"],
};

const BUSINESS_CONTEXT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    description: { type: "STRING" },
    products: { type: "ARRAY", items: { type: "STRING" } },
    tone: { type: "STRING" },
  },
  required: ["description", "products", "tone"],
};

const CLARIFY_TOPIC_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    topic: { type: "STRING", nullable: true },
  },
  required: ["topic"],
};

const POSTER_BENEFIT_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    subtext: { type: "STRING" },
  },
  required: ["headline", "subtext"],
};

const POSTER_HIGHLIGHTS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    benefits: { type: "ARRAY", items: POSTER_BENEFIT_SCHEMA },
    trustBadges: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["benefits", "trustBadges"],
};

// Real schema-level constraint (2026-09-03 natural-language poster
// editing), not just prompt instructions — Gemini's own responseSchema
// enforces `template`/`backgroundSource` can only ever be one of this
// app's real values, per Part 2.4's own "constrain what the schema
// allows to what the template system can actually render" requirement.
const POSTER_EDIT_COLORS_SCHEMA = {
  type: "OBJECT",
  properties: {
    primary: { type: "STRING" },
    secondary: { type: "STRING" },
    accent: { type: "STRING" },
  },
  required: ["primary", "secondary", "accent"],
};

const POSTER_EDIT_SPEC_SCHEMA = {
  type: "OBJECT",
  properties: {
    template: { type: "STRING", enum: [...TEMPLATE_IDS] },
    headline: { type: "STRING" },
    subhead: { type: "STRING", nullable: true },
    cta: { type: "STRING", nullable: true },
    backgroundSource: { type: "STRING", enum: ["BRAND", "PHOTO", "AI"] },
    backgroundAssetId: { type: "STRING", nullable: true },
    colors: POSTER_EDIT_COLORS_SCHEMA,
  },
  required: ["template", "headline", "backgroundSource", "colors"],
};

const POSTER_EDIT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    canApply: { type: "BOOLEAN" },
    explanation: { type: "STRING" },
    updatedSpec: { ...POSTER_EDIT_SPEC_SCHEMA, nullable: true },
    newImageRequest: { type: "STRING", nullable: true },
  },
  required: ["canApply", "explanation"],
};

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
    options: { jsonMode?: boolean; maxTokens?: number; responseSchema?: object } = {},
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
              // Real fix for a confirmed prod failure, not speculative: queried
              // ProviderFallbackEvent directly and found every expandBackgroundPrompt
              // MAX_TOKENS failure had only 54-70 chars of actual content — far too
              // short to be real JSON truncated near the end. Gemini 3 Flash's
              // "thinking" tokens count against maxOutputTokens and are on by default
              // (verified against ai.google.dev/gemini-api/docs/generate-content/
              // gemini-3), so a modest budget can be exhausted by hidden reasoning
              // before any visible output escapes. Applied unconditionally, not just
              // to jsonMode calls — caught live via this session's own testing:
              // generateCaption (plain text, no jsonMode) produced a truncated,
              // markdown-fragment caption for the exact same reason. None of these
              // methods are reasoning tasks — "low" is the documented setting for
              // that; Gemini 3 Flash doesn't support a full thinking-off.
              thinkingConfig: { thinkingLevel: "low" },
              ...(options.jsonMode
                ? {
                    responseMimeType: "application/json",
                    ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
                  }
                : {}),
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

  async generateReply({ context, incomingMessage, kind, authorName }: GenerateReplyInput): Promise<GenerateReplyOutput> {
    const { system, user } = buildReplyPrompt(context, incomingMessage, kind, authorName);
    // Same real, measured thinking-token headroom as generateCaption
    // below — a reply is the same short free-text shape, same risk of
    // the model's hidden reasoning alone exhausting a smaller budget.
    const { content, estimatedCostUsd } = await this.generateContent(system, user, { maxTokens: 700 });
    return { text: content, providerName: this.name, model: GEMINI_TEXT_MODEL, estimatedCostUsd };
  }

  async generateCaption({ context, topic }: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    const { system, user } = buildCaptionPrompt(context, topic);
    // 700, not 300 — 300 was still a guess and real production evidence
    // proved it wrong: 4 separate real captions truncated mid-sentence,
    // and a direct real API call with usageMetadata exposed the exact
    // cause — this model spends 414 real thinking tokens on this exact
    // prompt even at thinkingLevel:"low" (Gemini 3 Flash has no full
    // thinking-off), which alone exceeded the old 300 budget before any
    // visible answer text could complete. 700 leaves real, measured
    // headroom (~280 tokens) above that 414, not just a bigger guess.
    const { content, estimatedCostUsd } = await this.generateContent(system, user, { maxTokens: 700 });
    return { text: content, providerName: this.name, model: GEMINI_TEXT_MODEL, estimatedCostUsd };
  }

  async generateScript({ context, topic }: GenerateScriptInput): Promise<GenerateScriptOutput> {
    const { system, user } = buildScriptPrompt(context, topic);
    const { content, estimatedCostUsd, finishReason } = await this.generateContent(system, user, {
      jsonMode: true,
      maxTokens: 700,
      responseSchema: SCRIPT_RESPONSE_SCHEMA,
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
      itemAssetTypes: input.itemAssetTypes,
    });
    const { content, estimatedCostUsd, finishReason } = await this.generateContent(system, user, {
      jsonMode: true,
      // Scales with itemCount (up to 14 — see campaign.ts's own cap) instead of
      // a flat 1500: a multi-item brief's real token need grows with the item
      // count, and a fixed budget risked truncating longer campaigns/recurring
      // plans that request more items per call.
      maxTokens: Math.min(4000, 300 + input.itemCount * 220),
      responseSchema: CAMPAIGN_BRIEF_RESPONSE_SCHEMA,
    });

    const parsed = this.parseJsonOrThrow("generateCampaignBrief", "campaign brief", content, finishReason);

    const brief = parseCampaignBriefResponse(
      parsed,
      this.name,
      input.itemCount,
      input.connectedPlatforms,
      input.itemAssetTypes,
    );
    return { ...brief, model: GEMINI_TEXT_MODEL, estimatedCostUsd };
  }

  async expandBackgroundPrompt(input: ExpandBackgroundPromptInput): Promise<ExpandBackgroundPromptOutput> {
    const { system, user } = buildBackgroundExpansionPrompt(input);
    const { content, finishReason } = await this.generateContent(system, user, {
      jsonMode: true,
      maxTokens: 500,
      responseSchema: BACKGROUND_EXPANSION_RESPONSE_SCHEMA,
    });

    const parsed = this.parseJsonOrThrow("expandBackgroundPrompt", "background-prompt", content, finishReason);

    return parseExpandedPromptResponse(parsed, this.name);
  }

  async summarizeBusinessContext(input: SummarizeBusinessContextInput): Promise<SummarizeBusinessContextOutput> {
    const { system, user } = buildBusinessContextPrompt(input);
    const { content, finishReason } = await this.generateContent(system, user, {
      jsonMode: true,
      maxTokens: 500,
      responseSchema: BUSINESS_CONTEXT_RESPONSE_SCHEMA,
    });

    const parsed = this.parseJsonOrThrow("summarizeBusinessContext", "business-context", content, finishReason);

    const result = parseBusinessContextResponse(parsed, this.name);
    return { ...result, providerName: this.name };
  }

  async clarifyTopic(input: ClarifyTopicInput): Promise<ClarifyTopicOutput> {
    const { system, user } = buildClarifyTopicPrompt(input);
    const { content, finishReason } = await this.generateContent(system, user, {
      jsonMode: true,
      maxTokens: 100,
      responseSchema: CLARIFY_TOPIC_RESPONSE_SCHEMA,
    });

    const parsed = this.parseJsonOrThrow("clarifyTopic", "clarify-topic", content, finishReason);

    const clarifiedTopic = parseClarifyTopicResponse(parsed, this.name);
    return { clarifiedTopic, providerName: this.name };
  }

  async generatePosterHighlights(input: GeneratePosterHighlightsInput): Promise<GeneratePosterHighlightsOutput> {
    const { system, user } = buildPosterHighlightsPrompt(input);
    const { content, estimatedCostUsd, finishReason } = await this.generateContent(system, user, {
      jsonMode: true,
      maxTokens: 500,
      responseSchema: POSTER_HIGHLIGHTS_RESPONSE_SCHEMA,
    });

    const parsed = this.parseJsonOrThrow("generatePosterHighlights", "poster highlights", content, finishReason);

    const { benefits, trustBadges } = parsePosterHighlightsResponse(parsed, this.name);
    return { benefits, trustBadges, providerName: this.name, estimatedCostUsd };
  }

  async editPosterSpec(input: EditPosterInput): Promise<EditPosterOutput> {
    const { system, user } = buildPosterEditPrompt(input);
    // Real bug, found live (2026-09-04): 600 was the SMALLEST budget of
    // any JSON-mode call in this file despite POSTER_EDIT_RESPONSE_SCHEMA
    // being the most structurally complex one — a nested updatedSpec
    // object (template/headline/subhead/cta/backgroundSource/
    // backgroundAssetId) with its own nested colors object, on top of
    // canApply/explanation/newImageRequest. generateCaption/generateReply
    // above already measured real production evidence that thinking
    // tokens alone can consume ~414 tokens even at thinkingLevel:"low",
    // which is why they run at 700 for a much simpler plain-text
    // response; generateScript's comparably-sized 5-flat-string schema
    // also runs at 700. 600 here left less headroom than either, for a
    // schema with MORE fields — genuine truncation, silently masked by
    // shared-pool.ts's tryShared() falling back to the free template's
    // honest-but-misleading-in-this-case "needs a connected AI provider"
    // message on ANY failure, including this one. Raised to 900 by the
    // same reasoning (not an independent live measurement — no BYOK/
    // shared key was available in this dev environment to confirm the
    // exact real number the way generateCaption's fix originally did;
    // revisit with a real measurement if truncation is ever seen again).
    const { content, estimatedCostUsd, finishReason } = await this.generateContent(system, user, {
      jsonMode: true,
      maxTokens: 900,
      responseSchema: POSTER_EDIT_RESPONSE_SCHEMA,
    });

    const parsed = this.parseJsonOrThrow("editPosterSpec", "poster edit", content, finishReason);

    const validAssetIds = new Set(input.availablePhotos.map((p) => p.id));
    const { explanation, updatedSpec, newImageRequest } = parsePosterEditResponse(parsed, this.name, validAssetIds);
    return {
      available: true,
      updatedSpec: updatedSpec ?? undefined,
      explanation,
      newImageRequest: newImageRequest ?? undefined,
      providerName: this.name,
      estimatedCostUsd,
    };
  }
}
