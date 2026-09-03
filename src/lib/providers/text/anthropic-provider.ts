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

const MODEL = "claude-3-5-haiku-20241022";
// USD per token, rough estimate for display only — not billing-accurate.
const PRICE_PER_INPUT_TOKEN = 0.8 / 1_000_000;
const PRICE_PER_OUTPUT_TOKEN = 4 / 1_000_000;

interface AnthropicMessagesResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

const SCRIPT_SECTION_KEYS: (keyof VideoScriptSections)[] = ["hook", "context", "value", "message", "cta"];

// Claude sometimes wraps JSON in a ```json ... ``` fence despite being
// told not to — strip it rather than fail the whole generation on a
// cosmetic formatting quirk.
function stripCodeFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1] : text;
}

export class AnthropicTextProvider implements TextProvider {
  readonly name = "Anthropic";

  constructor(private readonly apiKey: string) {}

  private async messagesRequest(
    system: string,
    user: string,
    maxTokens = 150,
  ): Promise<{ content: string; estimatedCostUsd?: number }> {
    let response: Response;
    try {
      response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          system,
          messages: [{ role: "user", content: user }],
          max_tokens: maxTokens,
        }),
      });
    } catch (error) {
      throw new ProviderError(this.name, "Could not reach Anthropic (network error or timeout).", error);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new ProviderError(this.name, "Anthropic rejected the API key — check it in Settings.");
      }
      if (response.status === 429) {
        throw new ProviderError(this.name, "Anthropic rate-limited this request. Try again shortly.");
      }
      const body = await response.text().catch(() => "");
      throw new ProviderError(
        this.name,
        `Anthropic request failed (${response.status}). ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as AnthropicMessagesResponse;
    const text = data.content?.find((block) => block.type === "text")?.text?.trim();
    if (!text) {
      throw new ProviderError(this.name, "Anthropic returned an empty response.");
    }

    const usage = data.usage;
    const estimatedCostUsd = usage
      ? (usage.input_tokens ?? 0) * PRICE_PER_INPUT_TOKEN +
        (usage.output_tokens ?? 0) * PRICE_PER_OUTPUT_TOKEN
      : undefined;

    return { content: text, estimatedCostUsd };
  }

  async generateReply({ context, incomingMessage, kind, authorName }: GenerateReplyInput): Promise<GenerateReplyOutput> {
    const { system, user } = buildReplyPrompt(context, incomingMessage, kind, authorName);
    const { content, estimatedCostUsd } = await this.messagesRequest(system, user);
    return { text: content, providerName: this.name, model: MODEL, estimatedCostUsd };
  }

  async generateCaption({ context, topic }: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    const { system, user } = buildCaptionPrompt(context, topic);
    const { content, estimatedCostUsd } = await this.messagesRequest(system, user);
    return { text: content, providerName: this.name, model: MODEL, estimatedCostUsd };
  }

  async generateScript({ context, topic }: GenerateScriptInput): Promise<GenerateScriptOutput> {
    const { system, user } = buildScriptPrompt(context, topic);
    const { content, estimatedCostUsd } = await this.messagesRequest(system, user, 500);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch (error) {
      throw new ProviderError(this.name, "Anthropic returned malformed script JSON.", error);
    }

    if (typeof parsed !== "object" || parsed === null) {
      throw new ProviderError(this.name, "Anthropic returned an unexpected script format.");
    }
    const record = parsed as Record<string, unknown>;
    for (const key of SCRIPT_SECTION_KEYS) {
      if (typeof record[key] !== "string" || !record[key]) {
        throw new ProviderError(this.name, `Anthropic's script response is missing "${key}".`);
      }
    }

    const script = record as unknown as VideoScriptSections;
    return { script, providerName: this.name, model: MODEL, estimatedCostUsd };
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
    const { content, estimatedCostUsd } = await this.messagesRequest(system, user, 1500);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch (error) {
      throw new ProviderError(this.name, "Anthropic returned malformed campaign brief JSON.", error);
    }

    const brief = parseCampaignBriefResponse(
      parsed,
      this.name,
      input.itemCount,
      input.connectedPlatforms,
      input.itemAssetTypes,
    );
    return { ...brief, model: MODEL, estimatedCostUsd };
  }

  async expandBackgroundPrompt(input: ExpandBackgroundPromptInput): Promise<ExpandBackgroundPromptOutput> {
    const { system, user } = buildBackgroundExpansionPrompt(input);
    const { content } = await this.messagesRequest(system, user, 400);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch (error) {
      throw new ProviderError(this.name, "Anthropic returned malformed background-prompt JSON.", error);
    }

    return parseExpandedPromptResponse(parsed, this.name);
  }

  async summarizeBusinessContext(input: SummarizeBusinessContextInput): Promise<SummarizeBusinessContextOutput> {
    const { system, user } = buildBusinessContextPrompt(input);
    const { content } = await this.messagesRequest(system, user, 400);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch (error) {
      throw new ProviderError(this.name, "Anthropic returned malformed business-context JSON.", error);
    }

    const result = parseBusinessContextResponse(parsed, this.name);
    return { ...result, providerName: this.name };
  }

  async clarifyTopic(input: ClarifyTopicInput): Promise<ClarifyTopicOutput> {
    const { system, user } = buildClarifyTopicPrompt(input);
    const { content } = await this.messagesRequest(system, user, 60);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch (error) {
      throw new ProviderError(this.name, "Anthropic returned malformed clarify-topic JSON.", error);
    }

    const clarifiedTopic = parseClarifyTopicResponse(parsed, this.name);
    return { clarifiedTopic, providerName: this.name };
  }

  async generatePosterHighlights(input: GeneratePosterHighlightsInput): Promise<GeneratePosterHighlightsOutput> {
    const { system, user } = buildPosterHighlightsPrompt(input);
    const { content, estimatedCostUsd } = await this.messagesRequest(system, user, 400);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch (error) {
      throw new ProviderError(this.name, "Anthropic returned malformed poster-highlights JSON.", error);
    }

    const { benefits, trustBadges } = parsePosterHighlightsResponse(parsed, this.name);
    return { benefits, trustBadges, providerName: this.name, estimatedCostUsd };
  }

  async editPosterSpec(input: EditPosterInput): Promise<EditPosterOutput> {
    const { system, user } = buildPosterEditPrompt(input);
    // Raised from 500 alongside gemini-provider.ts's confirmed real fix
    // for the same method — this file doesn't have Gemini's specific
    // hidden-thinking-token issue, but 500 was still proportionally
    // undersized: generateScript's comparably-sized 5-flat-field schema
    // already gets 500, and this schema is strictly larger (an
    // explanation field on top of a nested updatedSpec object with its
    // own nested colors object). Reasoned by structural comparison, not
    // an independently confirmed failure report the way the Gemini
    // number was — revisit with real evidence if truncation is seen.
    const { content, estimatedCostUsd } = await this.messagesRequest(system, user, 700);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch (error) {
      throw new ProviderError(this.name, "Anthropic returned malformed poster-edit JSON.", error);
    }

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
