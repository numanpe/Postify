import "server-only";

import { fetchWithRetry } from "../http";
import type { PublishPostInput, PublishPostOutput, SocialProvider } from "./types";
import { SocialProviderError } from "./types";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

type GraphError = { error?: { message?: string } };

async function graphFetch<T>(
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "GET",
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const init: RequestInit = { method };
  if (method === "GET") {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  } else {
    init.body = new URLSearchParams(params);
  }

  const response = await fetchWithRetry(url.toString(), init, 30_000);
  const body = (await response.json()) as T & GraphError;
  if (!response.ok || body.error) {
    throw new SocialProviderError(
      "instagram",
      body.error?.message ?? `Instagram Graph API request to ${path} failed (${response.status}).`,
    );
  }
  return body;
}

// Instagram's media-container endpoint requires a publicly-fetchable
// image_url and cannot accept a direct binary upload — publicImageUrl
// (see src/lib/public-asset-links.ts) must be set for this provider.
// Container creation is asynchronous on Meta's side, so this polls
// status_code before calling media_publish, per Meta's documented flow —
// publishing a container that isn't FINISHED yet fails.
export class InstagramProvider implements SocialProvider {
  readonly platform = "INSTAGRAM" as const;

  constructor(
    private readonly igUserId: string,
    private readonly pageAccessToken: string,
  ) {}

  async publishPost(input: PublishPostInput): Promise<PublishPostOutput> {
    if (!input.publicImageUrl) {
      throw new SocialProviderError(
        "instagram",
        "Instagram publishing requires a public image URL, which was not provided.",
      );
    }

    const container = await graphFetch<{ id: string }>(
      `/${this.igUserId}/media`,
      { image_url: input.publicImageUrl, caption: input.caption, access_token: this.pageAccessToken },
      "POST",
    );

    await this.waitForContainerReady(container.id);

    const published = await graphFetch<{ id: string }>(
      `/${this.igUserId}/media_publish`,
      { creation_id: container.id, access_token: this.pageAccessToken },
      "POST",
    );

    return { externalPostId: published.id, externalPostUrl: await this.getPermalink(published.id) };
  }

  private async waitForContainerReady(containerId: string): Promise<void> {
    const maxAttempts = 10;
    const delayMs = 2_000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await graphFetch<{ status_code: string }>(`/${containerId}`, {
        fields: "status_code",
        access_token: this.pageAccessToken,
      });

      if (status.status_code === "FINISHED") return;
      if (status.status_code === "ERROR") {
        throw new SocialProviderError(
          "instagram",
          "Instagram failed to process the image before publishing.",
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new SocialProviderError(
      "instagram",
      "Timed out waiting for Instagram to finish processing the image.",
    );
  }

  // Never guess a post URL — only report one Meta actually confirms.
  private async getPermalink(mediaId: string): Promise<string | null> {
    try {
      const body = await graphFetch<{ permalink?: string }>(`/${mediaId}`, {
        fields: "permalink",
        access_token: this.pageAccessToken,
      });
      return body.permalink ?? null;
    } catch {
      return null;
    }
  }
}
