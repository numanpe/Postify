import "server-only";

import type { ImageProvider, GenerateBackgroundInput, GenerateBackgroundOutput } from "./types";
import { ImageProviderError } from "./types";
import { fetchWithRetry } from "../http";
import { GEMINI_IMAGE_MODEL } from "../gemini-models";

// BYOK. Verified directly against Google's official docs (ai.google.dev)
// before writing this, same discipline as Upload-Post/Fish Audio.
// Google's newer Interactions API (GA since June 2026) is the current,
// recommended surface for image generation — the older
// v1beta/models/{model}:generateContent endpoint (still used for plain
// text) doesn't document image-generation model support.
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

// "Nano Banana 2 Lite": cheapest real image-generation option
// confirmed via Google's pricing docs (~$0.034/image at 1K), and
// Google's own description — "cost-effective... high-volume
// interactive use cases" — matches this app's poster-background job
// exactly. 1K resolution only, which is what a poster background needs
// anyway (this app's own POSTER_DIMENSIONS tops out at 1920px on the
// long edge, well within 1K-class output before the existing
// composite/overlay pipeline resizes it). Re-verified live 2026-08-31
// during the gemini-2.5-flash text-model outage — still current, not
// in Google's deprecated/shut-down table, no change needed. Model ID
// now lives in gemini-models.ts (GEMINI_IMAGE_MODEL) — see that file's
// comment for the re-check cadence.

// Real, confirmed via Google's official pricing docs: there is NO free
// tier for any Gemini image-generation model — billing must be enabled
// on the account before the very first call, unlike Gemini's text
// models. A 401/403 here means "no key or no billing enabled", not
// "free quota exhausted" — the error message below says so honestly
// rather than implying a quota that doesn't exist.
const SUPPORTED_ASPECT_RATIOS = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;

function nearestAspectRatio(widthPx: number, heightPx: number): (typeof SUPPORTED_ASPECT_RATIOS)[number] {
  const target = widthPx / heightPx;
  let best: (typeof SUPPORTED_ASPECT_RATIOS)[number] = "1:1";
  let bestDiff = Infinity;
  for (const ratio of SUPPORTED_ASPECT_RATIOS) {
    const [w, h] = ratio.split(":").map(Number);
    const diff = Math.abs(w / h - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ratio;
    }
  }
  return best;
}

function buildBackgroundPrompt(input: GenerateBackgroundInput): string {
  return (
    `A professional marketing background photo for a ${input.industry} business. ` +
    `Mood/tone: ${input.tone}. Context: ${input.topic}. ` +
    "No text, no logos, no watermarks — a clean background suitable for overlaying headline text."
  );
}

interface GeminiContentItem {
  type?: string;
  mime_type?: string;
  data?: string;
}
interface GeminiStep {
  content?: GeminiContentItem[];
}
interface GeminiInteractionResponse {
  steps?: GeminiStep[];
}

export class GeminiImageProvider implements ImageProvider {
  readonly name = "Google Gemini";

  constructor(private readonly apiKey: string) {}

  async generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
    // Gemini's image models have no separate negative-prompt parameter
    // either — same "avoid" clause approach already used by the OpenAI
    // and Pollinations providers for consistency.
    const prompt = input.expandedPrompt
      ? `${input.expandedPrompt}${input.negativePrompt ? ` Avoid: ${input.negativePrompt}.` : ""}`
      : buildBackgroundPrompt(input);
    const aspectRatio = nearestAspectRatio(input.widthPx, input.heightPx);

    let response: Response;
    try {
      response = await fetchWithRetry(
        ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            model: GEMINI_IMAGE_MODEL,
            input: [{ type: "text", text: prompt }],
            response_format: {
              type: "image",
              mime_type: "image/png",
              aspect_ratio: aspectRatio,
              image_size: "1K",
            },
          }),
        },
        60_000,
      );
    } catch (error) {
      throw new ImageProviderError(this.name, "Could not reach Google Gemini (network error or timeout).", error);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Real, confirmed live behavior (not assumed): an invalid key
      // comes back as HTTP 400 INVALID_ARGUMENT with "API key not
      // valid" in the body, not 401/403 the way most other providers
      // in this app signal auth failure — verified directly against
      // the real endpoint with a deliberately invalid key before
      // shipping this. 401/403 are kept as a fallback in case Google's
      // behavior differs for other auth-failure shapes (e.g. a
      // revoked key), since both are real, plausible auth-error codes.
      if (response.status === 401 || response.status === 403 || /api key not valid/i.test(body)) {
        throw new ImageProviderError(
          this.name,
          "Google rejected this request — check the API key in Settings and confirm billing is enabled on the Google AI Studio project (Gemini image models have no free tier).",
        );
      }
      if (response.status === 429) {
        throw new ImageProviderError(this.name, "Google rate-limited this request. Try again shortly.");
      }
      throw new ImageProviderError(
        this.name,
        `Google Gemini image request failed (${response.status}). ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as GeminiInteractionResponse;
    const imageContent = data.steps?.flatMap((step) => step.content ?? []).find((item) => item.type === "image");
    if (!imageContent?.data) {
      throw new ImageProviderError(this.name, "Google Gemini returned no image data.");
    }

    return {
      buffer: Buffer.from(imageContent.data, "base64"),
      mimeType: imageContent.mime_type ?? "image/png",
      providerName: this.name,
    };
  }
}
