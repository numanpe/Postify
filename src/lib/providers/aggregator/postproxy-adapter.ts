import "server-only";

import { fetchWithRetry } from "../http";
import { createPublicAssetLink, revokePublicAssetLinksForAsset } from "@/lib/public-asset-links";
import type { AggregatorPostInput, AggregatorPostOutput, SocialAggregatorAdapter } from "./types";
import { AggregatorProviderError } from "./types";

// Verified against postproxy.dev/getting-started/quickstart/ and
// live-tested against the real endpoint with a deliberately invalid key
// (got a clean {"error":"Invalid API key"} 401, not a 404/malformed-request
// error — confirms this shape is real, not guessed). "profiles" accepts
// either platform names or profile IDs per the docs; this app always
// sends the accountId the user configured in Settings (a specific
// profile), never a bare platform name, so multi-account setups target
// the right one.
const API_BASE = "https://api.postproxy.dev/api";

interface CreatePostResponse {
  id?: string;
  url?: string;
  error?: string;
}

export class PostproxyAdapter implements SocialAggregatorAdapter {
  readonly provider = "POSTPROXY" as const;

  constructor(private readonly apiKey: string) {}

  async publishPost(input: AggregatorPostInput): Promise<AggregatorPostOutput> {
    if (input.platforms.length === 0) {
      throw new AggregatorProviderError("Postproxy", "No Postproxy-connected platform accounts were selected.");
    }

    // Postproxy's post endpoint takes a media URL, not a binary upload —
    // same public-URL constraint as Instagram's own Graph API, so this
    // reuses the app's existing short-lived public-link mechanism rather
    // than inventing a second one.
    const publicUrl = await createPublicAssetLink(input.mediaAssetId);
    try {
      const body: Record<string, unknown> = {
        post: { body: [input.captionText, ...input.hashtags].filter(Boolean).join("\n\n") },
        profiles: input.platforms.map((p) => p.accountId),
        media: [publicUrl],
      };
      if (input.scheduledTime) {
        (body.post as Record<string, unknown>).scheduled_at = input.scheduledTime.toISOString();
      }

      const response = await fetchWithRetry(
        `${API_BASE}/posts`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        30_000,
      );
      const result = (await response.json()) as CreatePostResponse;

      if (!response.ok || result.error || !result.id) {
        throw new AggregatorProviderError(
          "Postproxy",
          result.error ?? `Postproxy publish failed (${response.status}).`,
        );
      }

      return { externalPostId: result.id, externalPostUrl: result.url ?? null };
    } finally {
      await revokePublicAssetLinksForAsset(input.mediaAssetId);
    }
  }
}
