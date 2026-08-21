import "server-only";

import { fetchWithRetry } from "../http";
import type { EngagementResult, PublishPostInput, PublishPostOutput, SocialProvider } from "./types";
import { SocialProviderError } from "./types";
import { LINKEDIN_API_BASE } from "./linkedin-oauth";

// Kept in sync with linkedin-oauth.ts's LINKEDIN_VERSION — duplicated
// rather than imported since that constant isn't exported (it's an
// OAuth-module implementation detail); both need bumping together.
const LINKEDIN_VERSION = "202601";

function headers(accessToken: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Linkedin-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    ...extra,
  };
}

// Real LinkedIn Posts API flow, verified against current docs before
// writing this: register an image upload (returns an uploadUrl + image
// URN), PUT the binary to that URL, then reference the URN in the post
// body. LinkedIn's POST /rest/posts returns the created post's URN in
// the `x-restli-id` response header, not the JSON body — a real,
// documented quirk of LinkedIn's Rest.li-based APIs, not a guess.
export class LinkedInProvider implements SocialProvider {
  readonly platform = "LINKEDIN" as const;

  constructor(
    private readonly orgUrn: string,
    private readonly accessToken: string,
  ) {}

  async publishPost(input: PublishPostInput): Promise<PublishPostOutput> {
    if (!input.imageBuffer || !input.imageMimeType) {
      throw new SocialProviderError("linkedin", "LinkedIn publishing requires an image, which was not provided.");
    }

    const imageUrn = await this.uploadImage(input.imageBuffer);

    const response = await fetchWithRetry(
      `${LINKEDIN_API_BASE}/posts`,
      {
        method: "POST",
        headers: headers(this.accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          author: this.orgUrn,
          commentary: input.caption,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          content: { media: { id: imageUrn } },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
      },
      30_000,
    );

    const postUrn = response.headers.get("x-restli-id") ?? response.headers.get("x-linkedin-id");
    if (!response.ok || !postUrn) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new SocialProviderError(
        "linkedin",
        body?.message ?? `LinkedIn publish failed (${response.status}).`,
      );
    }

    return { externalPostId: postUrn, externalPostUrl: this.buildPostUrl(postUrn) };
  }

  // LinkedIn's organization post analytics live behind the Organization
  // Social Actions / Analytics APIs, which this integration hasn't
  // verified the same way the publish path was — rather than guess at
  // an endpoint shape, this is an honest "not built yet," matching
  // CLAUDE.md's no-fake-functionality rule.
  async getEngagement(): Promise<EngagementResult> {
    throw new SocialProviderError(
      "linkedin",
      "Engagement tracking for LinkedIn isn't built yet — this is a real gap, not a bug.",
    );
  }

  private async uploadImage(imageBuffer: Buffer): Promise<string> {
    const initResponse = await fetchWithRetry(
      `${LINKEDIN_API_BASE}/images?action=initializeUpload`,
      {
        method: "POST",
        headers: headers(this.accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({ initializeUploadRequest: { owner: this.orgUrn } }),
      },
      20_000,
    );
    const initBody = (await initResponse.json()) as {
      value?: { uploadUrl?: string; image?: string };
      message?: string;
    };
    const uploadUrl = initBody.value?.uploadUrl;
    const imageUrn = initBody.value?.image;
    if (!initResponse.ok || !uploadUrl || !imageUrn) {
      throw new SocialProviderError(
        "linkedin",
        initBody.message ?? `LinkedIn image upload initialization failed (${initResponse.status}).`,
      );
    }

    const putResponse = await fetchWithRetry(
      uploadUrl,
      { method: "PUT", headers: { Authorization: `Bearer ${this.accessToken}` }, body: new Uint8Array(imageBuffer) },
      30_000,
    );
    if (!putResponse.ok) {
      throw new SocialProviderError("linkedin", `LinkedIn image binary upload failed (${putResponse.status}).`);
    }

    return imageUrn;
  }

  // LinkedIn doesn't return a permalink from the Posts API — the
  // documented, working share-URL pattern derives it from the post URN.
  private buildPostUrl(postUrn: string): string | null {
    const encoded = encodeURIComponent(postUrn);
    return `https://www.linkedin.com/feed/update/${encoded}/`;
  }
}
