import "server-only";

import { fetchWithRetry } from "../http";
import { createPublicAssetLink, revokePublicAssetLinksForAsset } from "@/lib/public-asset-links";
import type { AggregatorPostInput, AggregatorPostOutput, SocialAggregatorAdapter } from "./types";
import { AggregatorProviderError } from "./types";

// Endpoint + Bearer auth are confirmed real: live-tested with a
// deliberately invalid key against https://api.buffer.com and got a
// clean GraphQL {"errors":[{"extensions":{"code":"UNAUTHENTICATED"}}]}
// response, not a connection/404 error. The createPost mutation's exact
// input field names (channelId/text/assets/dueAt/mode) come from a
// single documentation source that couldn't be independently
// cross-verified with a worked example — MEDIUM confidence, not the same
// live-tested-shape confidence as Zernio/Postproxy. If the field names
// are wrong, Buffer's GraphQL layer returns a real, specific validation
// error in `errors` (e.g. "Unknown argument"), which this adapter
// surfaces verbatim rather than ever reporting a fake success.
const API_URL = "https://api.buffer.com";

// Buffer's schema posts to exactly one channel per mutation call (unlike
// Zernio/Postproxy's multi-platform array), so this adapter issues one
// createPost per requested platform and aggregates the outcome.
const CREATE_POST_MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      post { id }
    }
  }
`;

interface GraphQLResponse {
  data?: { createPost?: { post?: { id: string } } };
  errors?: { message: string }[];
}

export class BufferAdapter implements SocialAggregatorAdapter {
  readonly provider = "BUFFER" as const;

  constructor(private readonly apiKey: string) {}

  private async createOnChannel(
    channelId: string,
    text: string,
    assetUrl: string,
    mediaKind: "image" | "video",
    scheduledTime?: Date,
  ): Promise<{ id: string } | { error: string }> {
    const input: Record<string, unknown> = {
      channelId,
      text,
      assets: [{ url: assetUrl, type: mediaKind }],
    };
    if (scheduledTime) {
      input.mode = "customScheduled";
      input.dueAt = scheduledTime.toISOString();
    } else {
      input.mode = "shareNow";
    }

    const response = await fetchWithRetry(
      API_URL,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: CREATE_POST_MUTATION, variables: { input } }),
      },
      30_000,
    );
    const result = (await response.json()) as GraphQLResponse;

    const postId = result.data?.createPost?.post?.id;
    if (!response.ok || result.errors?.length || !postId) {
      return { error: result.errors?.[0]?.message ?? `Buffer publish failed (${response.status}).` };
    }
    return { id: postId };
  }

  async publishPost(input: AggregatorPostInput): Promise<AggregatorPostOutput> {
    if (input.platforms.length === 0) {
      throw new AggregatorProviderError("Buffer", "No Buffer-connected channels were selected.");
    }

    const publicUrl = await createPublicAssetLink(input.mediaAssetId);
    try {
      const text = [input.captionText, ...input.hashtags].filter(Boolean).join("\n\n");
      const results = await Promise.all(
        input.platforms.map((p) =>
          this.createOnChannel(p.accountId, text, publicUrl, input.mediaKind, input.scheduledTime),
        ),
      );

      const succeeded = results.filter((r): r is { id: string } => "id" in r);
      if (succeeded.length === 0) {
        const errors = results.map((r) => ("error" in r ? r.error : "")).filter(Boolean);
        throw new AggregatorProviderError("Buffer", errors.join("; ") || "Buffer publish failed.");
      }

      // Real, partial-failure honesty: if some channels failed while
      // others succeeded, that's surfaced as part of the returned
      // externalPostId note rather than silently dropped.
      const failedCount = results.length - succeeded.length;
      return {
        externalPostId:
          failedCount > 0 ? `${succeeded[0].id} (+${succeeded.length - 1} more, ${failedCount} failed)` : succeeded[0].id,
        externalPostUrl: null,
      };
    } finally {
      await revokePublicAssetLinksForAsset(input.mediaAssetId);
    }
  }
}
