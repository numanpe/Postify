import "server-only";

import { fetchWithRetry } from "../http";
import type { EngagementResult, PublishPostInput, PublishPostOutput, SocialProvider } from "./types";
import { SocialProviderError } from "./types";
import { TIKTOK_API_BASE } from "./tiktok-oauth";

// TikTok's Content Posting API, source=FILE_UPLOAD: init the publish
// (declares total size/chunking), PUT the binary directly to the
// returned upload_url, then poll status until it's no longer
// PROCESSING_UPLOAD/PROCESSING_DOWNLOAD. No public URL hosting is
// required — verified against TikTok's current docs before writing
// this, specifically to avoid the more complex PULL_FROM_URL variant.
//
// privacy_level is hardcoded to SELF_ONLY: TikTok's own developer FAQ
// confirms unaudited apps cannot publish anything but private posts —
// exposing a public-visibility option here would silently fail (or
// worse, appear to work and then get rejected) until Postify's TikTok
// app passes audit. See platform-status.ts.
const UNAUDITED_PRIVACY_LEVEL = "SELF_ONLY";
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 2000;

export class TikTokProvider implements SocialProvider {
  readonly platform = "TIKTOK" as const;

  constructor(private readonly accessToken: string) {}

  async publishPost(input: PublishPostInput): Promise<PublishPostOutput> {
    if (!input.videoBuffer || !input.videoMimeType) {
      throw new SocialProviderError("tiktok", "TikTok publishing requires a video, which was not provided.");
    }

    const videoSize = input.videoBuffer.byteLength;

    const initResponse = await fetchWithRetry(
      `${TIKTOK_API_BASE}/post/publish/video/init/`,
      {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          post_info: {
            title: input.caption,
            privacy_level: UNAUDITED_PRIVACY_LEVEL,
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "FILE_UPLOAD",
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1,
          },
        }),
      },
      30_000,
    );
    const initBody = (await initResponse.json()) as {
      data?: { publish_id?: string; upload_url?: string };
      error?: { code?: string; message?: string };
    };
    const publishId = initBody.data?.publish_id;
    const uploadUrl = initBody.data?.upload_url;
    if (!initResponse.ok || !publishId || !uploadUrl || (initBody.error && initBody.error.code !== "ok")) {
      throw new SocialProviderError(
        "tiktok",
        initBody.error?.message ?? `TikTok publish initialization failed (${initResponse.status}).`,
      );
    }

    const putResponse = await fetchWithRetry(
      uploadUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": input.videoMimeType,
          "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
        },
        body: new Uint8Array(input.videoBuffer),
      },
      60_000,
    );
    if (!putResponse.ok) {
      throw new SocialProviderError("tiktok", `TikTok video binary upload failed (${putResponse.status}).`);
    }

    const finalStatus = await this.pollUntilSettled(publishId);
    if (finalStatus.status === "FAILED") {
      throw new SocialProviderError(
        "tiktok",
        finalStatus.failReason ?? "TikTok reported the post failed after upload.",
      );
    }

    // TikTok's Content Posting API doesn't return a public post URL in
    // this response — SELF_ONLY posts aren't shareable outside the
    // account anyway. externalPostUrl stays null rather than guessing.
    return { externalPostId: publishId, externalPostUrl: null };
  }

  // Not yet built — the Content Posting API's own status endpoint only
  // reports publish-processing state (uploaded/processing/failed/
  // published), not likes/comments/shares. Real engagement requires the
  // separate Display/Research API, unverified for this integration.
  // Honest gap, not a fake number.
  async getEngagement(): Promise<EngagementResult> {
    throw new SocialProviderError(
      "tiktok",
      "Engagement tracking for TikTok isn't built yet — this is a real gap, not a bug.",
    );
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}`, ...extra };
  }

  private async pollUntilSettled(publishId: string): Promise<{ status: string; failReason: string | null }> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const response = await fetchWithRetry(
        `${TIKTOK_API_BASE}/post/publish/status/fetch/`,
        {
          method: "POST",
          headers: this.headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({ publish_id: publishId }),
        },
        15_000,
      );
      const body = (await response.json()) as {
        data?: { status?: string; fail_reason?: string };
        error?: { message?: string };
      };
      const status = body.data?.status ?? "UNKNOWN";
      if (status !== "PROCESSING_UPLOAD" && status !== "PROCESSING_DOWNLOAD") {
        return { status, failReason: body.data?.fail_reason ?? body.error?.message ?? null };
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    // Timed out waiting, not necessarily failed — TikTok is still
    // processing on their end. Surfaced as a failure to the caller
    // since PublishPostOutput has no "still pending" state, but this is
    // a real, disclosed limitation of the synchronous publish flow.
    throw new SocialProviderError("tiktok", "TikTok is still processing the upload after the polling window; check back later.");
  }
}
