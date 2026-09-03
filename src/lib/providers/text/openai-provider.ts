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

const MODEL = "gpt-4o-mini";
// USD per token, rough estimate for display only — not billing-accurate.
const PRICE_PER_INPUT_TOKEN = 0.15 / 1_000_000;
const PRICE_PER_OUTPUT_TOKEN = 0.6 / 1_000_000;

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const SCRIPT_SECTION_KEYS: (keyof VideoScriptSections)[] = ["hook", "context", "value", "message", "cta"];

export class OpenAITextProvider implements TextProvider {
  readonly name = "OpenAI";

  constructor(private readonly apiKey: string) {}

  private async chatCompletion(
    system: string,
    user: string,
    options: { jsonMode?: boolean; maxTokens?: number } = {},
  ): Promise<{ content: string; estimatedCostUsd?: number }> {
    let response: Response;
    try {
      response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: options.maxTokens ?? 150,
          temperature: 0.7,
          ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch (error) {
      throw new ProviderError(this.name, "Could not reach OpenAI (network error or timeout).", error);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new ProviderError(this.name, "OpenAI rejected the API key — check it in Settings.");
      }
      if (response.status === 429) {
        throw new ProviderError(this.name, "OpenAI rate-limited this request. Try again shortly.");
      }
      const body = await response.text().catch(() => "");
      throw new ProviderError(this.name, `OpenAI request failed (${response.status}). ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new ProviderError(this.name, "OpenAI returned an empty response.");
    }

    const usage = data.usage;
    const estimatedCostUsd = usage
      ? (usage.prompt_tokens ?? 0) * PRICE_PER_INPUT_TOKEN +
        (usage.completion_tokens ?? 0) * PRICE_PER_OUTPUT_TOKEN
      : undefined;

    return { content, estimatedCostUsd };
  }

  async generateReply({ context, incomingMessage, kind, authorName }: GenerateReplyInput): Promise<GenerateReplyOutput> {
    const { system, user } = buildReplyPrompt(context, incomingMessage, kind, authorName);
    const { content, estimatedCostUsd } = await this.chatCompletion(system, user);
    return { text: content, providerName: this.name, model: MODEL, estimatedCostUsd };
  }

  async generateCaption({ context, topic }: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    const { system, user } = buildCaptionPrompt(context, topic);
    const { content, estimatedCostUsd } = await this.chatCompletion(system, user);
    return { text: content, providerName: this.name, model: MODEL, estimatedCostUsd };
  }

  async generateScript({ context, topic }: GenerateScriptInput): Promise<GenerateScriptOutput> {
    const { system, user } = buildScriptPrompt(context, topic);
    const { content, estimatedCostUsd } = await this.chatCompletion(system, user, {
      jsonMode: true,
      maxTokens: 500,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new ProviderError(this.name, "OpenAI returned malformed script JSON.", error);
    }

    if (typeof parsed !== "object" || parsed === null) {
      throw new ProviderError(this.name, "OpenAI returned an unexpected script format.");
    }
    const record = parsed as Record<string, unknown>;
    for (const key of SCRIPT_SECTION_KEYS) {
      if (typeof record[key] !== "string" || !record[key]) {
        throw new ProviderError(this.name, `OpenAI's script response is missing "${key}".`);
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
    const { content, estimatedCostUsd } = await this.chatCompletion(system, user, {
      jsonMode: true,
      maxTokens: 1500,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new ProviderError(this.name, "OpenAI returned malformed campaign brief JSON.", error);
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
    const { content } = await this.chatCompletion(system, user, { jsonMode: true, maxTokens: 400 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new ProviderError(this.name, "OpenAI returned malformed background-prompt JSON.", error);
    }

    return parseExpandedPromptResponse(parsed, this.name);
  }

  async summarizeBusinessContext(input: SummarizeBusinessContextInput): Promise<SummarizeBusinessContextOutput> {
    const { system, user } = buildBusinessContextPrompt(input);
    const { content } = await this.chatCompletion(system, user, { jsonMode: true, maxTokens: 400 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new ProviderError(this.name, "OpenAI returned malformed business-context JSON.", error);
    }

    const result = parseBusinessContextResponse(parsed, this.name);
    return { ...result, providerName: this.name };
  }

  async clarifyTopic(input: ClarifyTopicInput): Promise<ClarifyTopicOutput> {
    const { system, user } = buildClarifyTopicPrompt(input);
    const { content } = await this.chatCompletion(system, user, { jsonMode: true, maxTokens: 60 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new ProviderError(this.name, "OpenAI returned malformed clarify-topic JSON.", error);
    }

    const clarifiedTopic = parseClarifyTopicResponse(parsed, this.name);
    return { clarifiedTopic, providerName: this.name };
  }

  async generatePosterHighlights(input: GeneratePosterHighlightsInput): Promise<GeneratePosterHighlightsOutput> {
    const { system, user } = buildPosterHighlightsPrompt(input);
    const { content, estimatedCostUsd } = await this.chatCompletion(system, user, { jsonMode: true, maxTokens: 400 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new ProviderError(this.name, "OpenAI returned malformed poster-highlights JSON.", error);
    }

    const { benefits, trustBadges } = parsePosterHighlightsResponse(parsed, this.name);
    return { benefits, trustBadges, providerName: this.name, estimatedCostUsd };
  }

  async editPosterSpec(input: EditPosterInput): Promise<EditPosterOutput> {
    const { system, user } = buildPosterEditPrompt(input);
    const { content, estimatedCostUsd } = await this.chatCompletion(system, user, { jsonMode: true, maxTokens: 500 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new ProviderError(this.name, "OpenAI returned malformed poster-edit JSON.", error);
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
