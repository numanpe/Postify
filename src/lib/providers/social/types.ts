import type { SocialPlatform } from "@prisma/client";

export interface PublishPostInput {
  imageBuffer: Buffer;
  imageMimeType: string;
  caption: string;
  // Only used by providers whose publish call requires a public URL
  // rather than a direct binary upload (Instagram) — see
  // src/lib/public-asset-links.ts. Providers that upload the binary
  // directly (Facebook) ignore this.
  publicImageUrl?: string;
}

export interface PublishPostOutput {
  externalPostId: string;
  externalPostUrl: string | null;
}

export interface EngagementResult {
  likes: number;
  comments: number;
  shares: number;
  // Instagram only — see EngagementSnapshot.reach in schema.prisma for
  // why "impressions" isn't used (deprecated by Meta for media created
  // after 2024-07-02).
  reach?: number;
}

export interface SocialProvider {
  readonly platform: SocialPlatform;
  publishPost(input: PublishPostInput): Promise<PublishPostOutput>;
  getEngagement(externalPostId: string): Promise<EngagementResult>;
}

// Same contract as ImageProviderError/ProviderError: surfaced directly to
// the user, never swallowed into a silent "published successfully."
export class SocialProviderError extends Error {
  constructor(
    public providerName: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SocialProviderError";
  }
}
