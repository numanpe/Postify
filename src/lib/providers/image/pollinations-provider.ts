import "server-only";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import type { ImageProvider, GenerateBackgroundInput, GenerateBackgroundOutput } from "./types";
import { ImageProviderError } from "./types";
import { fetchWithRetry } from "../http";

const ENDPOINT = "https://image.pollinations.ai/prompt";

// Free, no-key, open-source-model image generation (community-run —
// not an official/paid Pollinations product) — the zero-setup fallback
// for AI-generated poster backgrounds when no OpenAI key is configured.
// Genuinely slower and less predictable than a paid provider: observed
// latency in the 9-45s+ range and occasional outright timeouts during
// testing, so callers must treat failure as an honest "unavailable
// right now" outcome, never a silent fallback to blank/placeholder
// output. The service also doesn't reliably honor the requested pixel
// dimensions (it returns whatever its underlying model natively
// produces, same aspect ratio, different absolute size), so output is
// always re-sized server-side to exactly what the poster template
// needs.
export class PollinationsImageProvider implements ImageProvider {
  readonly name = "Free (open-source AI)";

  async generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
    // Pollinations' simple GET API has no separate negative-prompt
    // parameter, so fold it into the main prompt as an "avoid" clause,
    // same as the OpenAI provider.
    const prompt = input.expandedPrompt
      ? `${input.expandedPrompt}${input.negativePrompt ? ` Avoid: ${input.negativePrompt}.` : ""}`
      : buildBackgroundPrompt(input);
    // A random seed defeats Pollinations' prompt-based caching — without
    // it, regenerating the "same" background (same industry/tone/topic)
    // would return the literal same cached image every time.
    const seed = randomUUID();
    const url =
      `${ENDPOINT}/${encodeURIComponent(prompt)}` +
      `?width=${input.widthPx}&height=${input.heightPx}&nologo=true&seed=${seed}`;

    let response: Response;
    try {
      response = await fetchWithRetry(url, { method: "GET" }, 45_000);
    } catch (error) {
      throw new ImageProviderError(
        this.name,
        "AI background unavailable right now — try again shortly.",
        error,
      );
    }

    if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("image/")) {
      throw new ImageProviderError(this.name, "AI background unavailable right now — try again shortly.");
    }

    const rawBuffer = Buffer.from(await response.arrayBuffer());
    // A real failure sometimes comes back as a 200 with a tiny
    // error/placeholder body rather than a non-2xx status — treat an
    // implausibly small "image" as a failure too, not success.
    if (rawBuffer.byteLength < 2048) {
      throw new ImageProviderError(this.name, "AI background unavailable right now — try again shortly.");
    }

    let buffer: Buffer;
    try {
      buffer = await sharp(rawBuffer)
        .resize(input.widthPx, input.heightPx, { fit: "cover" })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch (error) {
      throw new ImageProviderError(this.name, "AI background unavailable right now — try again shortly.", error);
    }

    return { buffer, mimeType: "image/jpeg", providerName: this.name };
  }
}

function buildBackgroundPrompt(input: GenerateBackgroundInput): string {
  return (
    `A professional marketing background photo for a ${input.industry} business. ` +
    `Mood/tone: ${input.tone}. Context: ${input.topic}. ` +
    "No text, no logos, no watermarks — a clean background suitable for overlaying headline text."
  );
}
