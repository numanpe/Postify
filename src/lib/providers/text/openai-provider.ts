import "server-only";

import type {
  TextProvider,
  GenerateCaptionInput,
  GenerateCaptionOutput,
  GenerateScriptInput,
  GenerateScriptOutput,
  VideoScriptSections,
} from "./types";
import { ProviderError } from "./types";
import { buildCaptionPrompt, buildScriptPrompt } from "./prompt";
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
}
