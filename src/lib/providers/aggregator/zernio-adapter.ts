import "server-only";

import { fetchWithRetry } from "../http";
import type { AggregatorPostInput, AggregatorPostOutput, SocialAggregatorAdapter } from "./types";
import { AggregatorProviderError } from "./types";

// Built against docs.zernio.com's real, current documentation (fetched
// and verified before this file was written — see the Provider Reality
// Check): base URL, auth header, and both the media-presign and
// post-creation request/response shapes are all real, not guessed.
const API_BASE = "https://zernio.com/api/v1";

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

interface CreatePostResponse {
  post?: {
    _id: string;
    content: string;
    status: string;
    platformPostUrl?: string;
  };
  error?: { message?: string };
}

export class ZernioAdapter implements SocialAggregatorAdapter {
  readonly provider = "ZERNIO" as const;

  constructor(private readonly apiKey: string) {}

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  // Step 1+2 of Zernio's real 3-step flow: get a presigned upload URL,
  // then PUT the raw bytes directly to it (no auth header on the PUT —
  // the presigned URL itself is the credential, per Zernio's own docs).
  private async uploadMedia(buffer: Buffer, mimeType: string, kind: "image" | "video"): Promise<string> {
    const extension = kind === "image" ? "jpg" : "mp4";
    const presignResponse = await fetchWithRetry(
      `${API_BASE}/media/presign`,
      {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({ filename: `postify-${Date.now()}.${extension}`, contentType: mimeType }),
      },
      20_000,
    );
    if (!presignResponse.ok) {
      throw new AggregatorProviderError(
        "Zernio",
        `Couldn't get an upload URL from Zernio (${presignResponse.status}).`,
      );
    }
    const presign = (await presignResponse.json()) as PresignResponse;

    const uploadResponse = await fetchWithRetry(
      presign.uploadUrl,
      { method: "PUT", headers: { "Content-Type": mimeType }, body: new Uint8Array(buffer) },
      60_000,
    );
    if (!uploadResponse.ok) {
      throw new AggregatorProviderError("Zernio", `Media upload to Zernio failed (${uploadResponse.status}).`);
    }

    return presign.publicUrl;
  }

  async publishPost(input: AggregatorPostInput): Promise<AggregatorPostOutput> {
    if (input.platforms.length === 0) {
      throw new AggregatorProviderError("Zernio", "No Zernio-connected platform accounts were selected.");
    }

    const publicUrl = await this.uploadMedia(input.mediaBuffer, input.mediaMimeType, input.mediaKind);
    const content = [input.captionText, ...input.hashtags].filter(Boolean).join("\n\n");

    const body: Record<string, unknown> = {
      content,
      mediaItems: [{ url: publicUrl, type: input.mediaKind }],
      // Part 3's real trending-audio attachment: audioConfiguration on
      // InstagramPlatformData, Reels only. Meta rejects (not silently
      // drops) an audioId that's gone stale by publish time — see
      // AggregatorPostInput.instagramAudioId's own doc comment on why
      // this is a real by-reference attachment, never a downloaded/baked
      // asset. Only the "instagram" entry gets it; every other platform
      // in the same multi-target publish is untouched.
      platforms: input.platforms.map((p) =>
        p.platform === "instagram" && input.instagramAudioId && input.mediaKind === "video"
          ? { platform: p.platform, accountId: p.accountId, platformSpecificData: { audioConfiguration: { audioId: input.instagramAudioId } } }
          : { platform: p.platform, accountId: p.accountId },
      ),
    };
    if (input.scheduledTime) {
      body.scheduledFor = input.scheduledTime.toISOString();
      body.timezone = "UTC";
    } else {
      body.publishNow = true;
    }

    const response = await fetchWithRetry(
      `${API_BASE}/posts`,
      { method: "POST", headers: this.authHeaders(), body: JSON.stringify(body) },
      30_000,
    );
    const result = (await response.json()) as CreatePostResponse;

    if (!response.ok || result.error || !result.post) {
      throw new AggregatorProviderError(
        "Zernio",
        result.error?.message ?? `Zernio publish failed (${response.status}).`,
      );
    }
    if (result.post.status === "failed") {
      throw new AggregatorProviderError("Zernio", "Zernio reported this post failed to publish.");
    }

    return {
      externalPostId: result.post._id,
      externalPostUrl: result.post.platformPostUrl ?? null,
    };
  }
}
