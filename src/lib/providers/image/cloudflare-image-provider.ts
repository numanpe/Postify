import "server-only";
import sharp from "sharp";

import type { ImageProvider, GenerateBackgroundInput, GenerateBackgroundOutput } from "./types";
import { ImageProviderError } from "./types";
import { fetchWithRetry } from "../http";

// Verified directly against Cloudflare's real official docs
// (developers.cloudflare.com/workers-ai) before writing this, same
// discipline as every other provider in this app — including a real
// live test call with a fabricated token (confirmed the real 401
// shape) and real successful generations against real Visual Prompt
// Engineer-style prompts (agriculture/real-estate/construction),
// visually inspected before this was implemented.
const API_BASE = "https://api.cloudflare.com/client/v4/accounts";

// Real, confirmed-live (per Cloudflare's REST error taxonomy docs):
// Cloudflare's daily free-tier neuron quota exhaustion is documented as
// internal error code 3036 (HTTP 429) — distinct from code 3040
// ("Capacity temporarily exceeded", a transient infrastructure issue
// unrelated to quota, also HTTP 429). shared-image-pool.ts's circuit
// breaker must only react to real quota exhaustion, or a one-off
// capacity blip would wrongly disable the whole pool for the rest of
// the day.
//
// HOWEVER: a real production incident (2026-08-24, confirmed via
// `vercel logs`) showed the Workers AI binding does NOT always return
// that documented {code, message} shape for this exact condition — the
// real body observed was `{"errors":[{"message":"AiError: AiError: you
// have used up your daily free allocation of 10,000 neurons..."}]}`,
// with no numeric `code` field at all. Relying on the code alone left
// this silently unrecognized: the circuit breaker never tripped,
// SharedAiUsage never recorded the exhaustion, and every request kept
// wastefully retrying both models before falling back to the gradient
// with zero trace. Matching on the documented message text as well
// (case-insensitive substring) closes that gap without weakening the
// code-based check — both are real, both are checked.
const QUOTA_EXHAUSTED_CODE = 3036;
const QUOTA_EXHAUSTED_MESSAGE_MARKER = "daily free allocation";

export class CloudflareQuotaExhaustedError extends ImageProviderError {}

interface CloudflareErrorBody {
  errors?: { code?: number; message?: string }[];
}

function buildBackgroundPrompt(input: GenerateBackgroundInput): string {
  // Real, confirmed-live bug (2026-09-01 acceptance test): video B-roll
  // passes a full script sentence as `topic` (e.g. "Straight from our
  // farm to your family."), and the old "Context: {{topic}}." phrasing
  // reads like a caption to display — the model rendered that exact
  // sentence as garbled, edge-clipped on-image text, recurring across
  // every industry tested, not a one-off. Posters (shorter, non-
  // sentence topics) hit a milder version of the same failure. Framing
  // the topic as something to depict rather than display, and naming
  // the failure mode explicitly in the negative instruction, is a real
  // targeted mitigation for the specific mechanism found — not a
  // guaranteed fix (no prompt alone eliminates this for every model),
  // so the existing one-click regenerate affordance stays the real
  // safety net.
  const base = input.expandedPrompt
    ? `${input.expandedPrompt}${input.negativePrompt ? ` Avoid: ${input.negativePrompt}.` : ""}`
    : `A professional marketing background photo for a ${input.industry} business. ` +
      `Mood/tone: ${input.tone}. The scene should evoke: ${input.topic} ` +
      "— depict this visually only, never as on-image text, captions, signage, or lettering. " +
      "No text, no logos, no watermarks, no lettering of any kind — a clean background photo suitable for overlaying headline text separately.";
  return base;
}

async function readErrorCode(response: Response): Promise<{ isQuotaExhausted: boolean; body: string }> {
  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body) as CloudflareErrorBody;
    const message = parsed.errors?.[0]?.message ?? "";
    const isQuotaExhausted =
      parsed.errors?.[0]?.code === QUOTA_EXHAUSTED_CODE ||
      message.toLowerCase().includes(QUOTA_EXHAUSTED_MESSAGE_MARKER);
    return { isQuotaExhausted, body };
  } catch {
    return { isQuotaExhausted: false, body };
  }
}

// FLUX.1-schnell (Black Forest Labs) — the durable baseline (real
// metered neuron cost, not a beta-priced freebie like SDXL below).
// Real, confirmed-live: no width/height parameter exists for this
// model — output comes back at whatever size it natively produces, so
// (same reasoning the now-removed Pollinations provider used) the result is always
// re-sized server-side to exactly what the poster template needs.
// Response is real, confirmed-live JSON: { result: { image: "<base64
// JPEG>" } }.
export class CloudflareFluxImageProvider implements ImageProvider {
  readonly name = "Free AI";

  constructor(
    private readonly accountId: string,
    private readonly apiToken: string,
  ) {}

  async generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
    const prompt = buildBackgroundPrompt(input);

    let response: Response;
    try {
      response = await fetchWithRetry(
        `${API_BASE}/${this.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiToken}`,
          },
          // steps: 8 is the real documented max for this model — higher
          // quality than the 4-step default at a real, still-fast cost.
          body: JSON.stringify({ prompt, steps: 8 }),
        },
        30_000,
      );
    } catch (error) {
      throw new ImageProviderError(this.name, "Could not reach Cloudflare Workers AI (network error or timeout).", error);
    }

    if (!response.ok) {
      const { isQuotaExhausted, body } = await readErrorCode(response);
      if (isQuotaExhausted) {
        throw new CloudflareQuotaExhaustedError(this.name, "Today's free AI image quota is used up.");
      }
      throw new ImageProviderError(this.name, `Cloudflare Workers AI (FLUX) request failed (${response.status}). ${body.slice(0, 200)}`);
    }

    let data: { result?: { image?: string } };
    try {
      data = (await response.json()) as { result?: { image?: string } };
    } catch (error) {
      throw new ImageProviderError(this.name, "Cloudflare Workers AI (FLUX) returned an unreadable response.", error);
    }
    if (!data.result?.image) {
      throw new ImageProviderError(this.name, "Cloudflare Workers AI (FLUX) returned no image data.");
    }

    const rawBuffer = Buffer.from(data.result.image, "base64");
    let buffer: Buffer;
    try {
      buffer = await sharp(rawBuffer).resize(input.widthPx, input.heightPx, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
    } catch (error) {
      throw new ImageProviderError(this.name, "Cloudflare Workers AI (FLUX) returned an unreadable image.", error);
    }

    return { buffer, mimeType: "image/jpeg", providerName: this.name };
  }
}

// Stable Diffusion XL — kept available alongside FLUX because it
// genuinely does something FLUX can't: real width/height control
// (256-2048px, confirmed via real live calls at this app's actual
// poster dimensions, all well within that range), meaning the raw
// output already matches the target aspect ratio instead of always
// needing a center-crop. Its $0.00/step pricing is Cloudflare's own
// docs explicitly calling it beta — not relied on as permanent; this
// provider is priced/treated the same as FLUX either way (shares the
// same account-wide neuron budget and the same QuotaExhaustedError
// contract), so a pricing change here doesn't require any code change,
// only Cloudflare's bill.
export class CloudflareSdxlImageProvider implements ImageProvider {
  readonly name = "Free AI";

  constructor(
    private readonly accountId: string,
    private readonly apiToken: string,
  ) {}

  async generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
    const prompt = buildBackgroundPrompt(input);

    let response: Response;
    try {
      response = await fetchWithRetry(
        `${API_BASE}/${this.accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify({
            prompt,
            negative_prompt: input.negativePrompt,
            width: input.widthPx,
            height: input.heightPx,
            num_steps: 20,
          }),
        },
        45_000,
      );
    } catch (error) {
      throw new ImageProviderError(this.name, "Could not reach Cloudflare Workers AI (network error or timeout).", error);
    }

    if (!response.ok) {
      const { isQuotaExhausted, body } = await readErrorCode(response);
      if (isQuotaExhausted) {
        throw new CloudflareQuotaExhaustedError(this.name, "Today's free AI image quota is used up.");
      }
      throw new ImageProviderError(this.name, `Cloudflare Workers AI (SDXL) request failed (${response.status}). ${body.slice(0, 200)}`);
    }

    // Real, confirmed-live: SDXL returns raw binary image bytes
    // directly (Content-Type: image/png) — NOT the JSON-wrapped base64
    // shape FLUX uses above. Different models on the same platform,
    // genuinely different response shapes; handled explicitly rather
    // than assumed uniform.
    const rawBuffer = Buffer.from(await response.arrayBuffer());
    if (rawBuffer.byteLength < 2048) {
      throw new ImageProviderError(this.name, "Cloudflare Workers AI (SDXL) returned an implausibly small image.");
    }

    let buffer: Buffer;
    try {
      // Still re-sized (not just passed through) even though SDXL
      // already received the exact target dimensions — cheap insurance
      // against the rare case the model doesn't return exactly what
      // was requested, same defensive posture the now-removed
      // Pollinations provider already established.
      buffer = await sharp(rawBuffer).resize(input.widthPx, input.heightPx, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
    } catch (error) {
      throw new ImageProviderError(this.name, "Cloudflare Workers AI (SDXL) returned an unreadable image.", error);
    }

    return { buffer, mimeType: "image/jpeg", providerName: this.name };
  }
}
