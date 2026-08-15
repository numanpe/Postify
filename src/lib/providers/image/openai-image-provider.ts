import "server-only";

import type { ImageProvider, GenerateBackgroundInput, GenerateBackgroundOutput } from "./types";
import { ImageProviderError } from "./types";
import { fetchWithRetry } from "../http";

function nearestSize(widthPx: number, heightPx: number): "1024x1024" | "1024x1536" | "1536x1024" {
  if (widthPx === heightPx) return "1024x1024";
  return heightPx > widthPx ? "1024x1536" : "1536x1024";
}

function buildBackgroundPrompt(input: GenerateBackgroundInput): string {
  return (
    `A professional marketing background photo for a ${input.industry} business. ` +
    `Mood/tone: ${input.tone}. Context: ${input.topic}. ` +
    "No text, no logos, no watermarks — a clean background suitable for overlaying headline text."
  );
}

interface OpenAIImageResponse {
  data?: { b64_json?: string }[];
}

export class OpenAIImageProvider implements ImageProvider {
  readonly name = "OpenAI";

  constructor(private readonly apiKey: string) {}

  async generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
    const prompt = buildBackgroundPrompt(input);
    const size = nearestSize(input.widthPx, input.heightPx);

    let response: Response;
    try {
      response = await fetchWithRetry(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ model: "gpt-image-1", prompt, size, n: 1 }),
        },
        60_000,
      );
    } catch (error) {
      throw new ImageProviderError(this.name, "Could not reach OpenAI (network error or timeout).", error);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new ImageProviderError(this.name, "OpenAI rejected the API key — check it in Settings.");
      }
      if (response.status === 429) {
        throw new ImageProviderError(this.name, "OpenAI rate-limited this request. Try again shortly.");
      }
      const body = await response.text().catch(() => "");
      throw new ImageProviderError(
        this.name,
        `OpenAI image request failed (${response.status}). ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as OpenAIImageResponse;
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      throw new ImageProviderError(this.name, "OpenAI returned no image data.");
    }

    return { buffer: Buffer.from(b64, "base64"), mimeType: "image/png", providerName: this.name };
  }
}
