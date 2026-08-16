import "server-only";

import { fetchWithRetry } from "../http";
import type { PublishPostInput, PublishPostOutput, SocialProvider } from "./types";
import { SocialProviderError } from "./types";

const GRAPH_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Facebook's Page photo endpoint accepts a direct multipart binary
// upload — unlike Instagram, no public-URL round-trip is needed.
export class FacebookPageProvider implements SocialProvider {
  readonly platform = "FACEBOOK" as const;

  constructor(
    private readonly pageId: string,
    private readonly pageAccessToken: string,
  ) {}

  async publishPost(input: PublishPostInput): Promise<PublishPostOutput> {
    const form = new FormData();
    form.set("caption", input.caption);
    form.set("access_token", this.pageAccessToken);
    form.set(
      "source",
      new Blob([new Uint8Array(input.imageBuffer)], { type: input.imageMimeType }),
      "photo",
    );

    const response = await fetchWithRetry(
      `${GRAPH_BASE}/${this.pageId}/photos`,
      { method: "POST", body: form },
      30_000,
    );

    const body = (await response.json()) as {
      id?: string;
      post_id?: string;
      error?: { message?: string };
    };
    const externalPostId = body.post_id ?? body.id;
    if (!response.ok || body.error || !externalPostId) {
      throw new SocialProviderError(
        "facebook",
        body.error?.message ?? `Facebook publish failed (${response.status}).`,
      );
    }

    return { externalPostId, externalPostUrl: await this.getPermalink(externalPostId) };
  }

  // Never guess a post URL — only report one Meta actually confirms.
  private async getPermalink(postId: string): Promise<string | null> {
    try {
      const url = new URL(`${GRAPH_BASE}/${postId}`);
      url.searchParams.set("fields", "permalink_url");
      url.searchParams.set("access_token", this.pageAccessToken);
      const response = await fetchWithRetry(url.toString(), { method: "GET" }, 15_000);
      const body = (await response.json()) as { permalink_url?: string };
      return body.permalink_url ?? null;
    } catch {
      return null;
    }
  }
}
