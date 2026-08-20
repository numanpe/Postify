import "server-only";

import { fetchWithRetry } from "../http";
import { createPublicAssetLink, revokePublicAssetLinksForAsset } from "@/lib/public-asset-links";
import type { AggregatorPostInput, AggregatorPostOutput, SocialAggregatorAdapter } from "./types";
import { AggregatorProviderError } from "./types";

// See the confidence-level comment on the UPLOAD_POST entry in types.ts —
// endpoint/auth/error-shape are confirmed real via a live probe; the
// exact field names are inferred from this API's confirmed sibling video
// endpoint, not independently confirmed for /upload_photos itself. A
// wrong field name surfaces as this API's own real, structured error
// message (see publishPost's error handling), never a fake success.
const ENDPOINT = "https://api.upload-post.com/api/upload_photos";

interface UploadPostResponse {
  success: boolean;
  message?: string;
  request_id?: string;
}

// Video items aren't supported — /upload_photos is a photo-only
// endpoint per its name and the "image carousels" description in
// Upload-Post's own docs; this app's video items would need the
// separate, differently-shaped /upload endpoint, not built here.
export class UploadPostAdapter implements SocialAggregatorAdapter {
  readonly provider = "UPLOAD_POST" as const;

  constructor(private readonly apiKey: string) {}

  async publishPost(input: AggregatorPostInput): Promise<AggregatorPostOutput> {
    if (input.mediaKind !== "image") {
      throw new AggregatorProviderError(
        "Upload-Post",
        "Upload-Post publishing only supports posters (images) in this app — the video endpoint has a different, unverified shape.",
      );
    }
    if (input.platforms.length === 0) {
      throw new AggregatorProviderError("Upload-Post", "No Upload-Post platforms were selected.");
    }
    if (!input.profileHint) {
      throw new AggregatorProviderError(
        "Upload-Post",
        'No Upload-Post profile configured — add a "_PROFILE_:your_upload_post_username" entry in Settings.',
      );
    }

    const publicUrl = await createPublicAssetLink(input.mediaAssetId);
    try {
      const form = new FormData();
      form.set("user", input.profileHint);
      for (const p of input.platforms) {
        form.append("platform[]", p.platform);
      }
      form.append("photos[]", publicUrl);
      form.set("title", [input.captionText, ...input.hashtags].filter(Boolean).join("\n\n"));
      if (input.scheduledTime) {
        form.set("scheduled_date", input.scheduledTime.toISOString());
      }

      const response = await fetchWithRetry(
        ENDPOINT,
        { method: "POST", headers: { Authorization: `Apikey ${this.apiKey}` }, body: form },
        30_000,
      );
      const result = (await response.json()) as UploadPostResponse;

      if (!response.ok || !result.success || !result.request_id) {
        throw new AggregatorProviderError(
          "Upload-Post",
          result.message ?? `Upload-Post publish failed (${response.status}).`,
        );
      }

      // Upload-Post's response doesn't include a per-post external ID or
      // permalink synchronously (async processing, per its own docs) —
      // the request_id is the only real handle it gives back.
      return { externalPostId: result.request_id, externalPostUrl: null };
    } finally {
      await revokePublicAssetLinksForAsset(input.mediaAssetId);
    }
  }
}
