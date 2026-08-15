import "server-only";

import type { TextProvider, GenerateCaptionInput, GenerateCaptionOutput } from "./types";
import { ProviderError } from "./types";
import { buildCaptionPrompt } from "./prompt";
import { fetchWithRetry } from "./http";

const MODEL = "claude-3-5-haiku-20241022";
// USD per token, rough estimate for display only — not billing-accurate.
const PRICE_PER_INPUT_TOKEN = 0.8 / 1_000_000;
const PRICE_PER_OUTPUT_TOKEN = 4 / 1_000_000;

interface AnthropicMessagesResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicTextProvider implements TextProvider {
  readonly name = "Anthropic";

  constructor(private readonly apiKey: string) {}

  async generateCaption({ context, topic }: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    const { system, user } = buildCaptionPrompt(context, topic);

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
          max_tokens: 150,
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

    return { text, providerName: this.name, model: MODEL, estimatedCostUsd };
  }
}
