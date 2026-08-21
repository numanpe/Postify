import type { SocialPlatform } from "@prisma/client";

// Both platforms have real, working OAuth + publish adapters
// (linkedin-provider.ts, tiktok-provider.ts) — the API calls genuinely
// work today. What's gated is the *app*, not the caller's credentials,
// which is why this can't be treated as equivalent to Facebook/
// Instagram's already-working connection:
//
// - LinkedIn: posting to an Organization page requires the Community
//   Management API product, which LinkedIn must approve per-app before
//   any post to a real org succeeds.
// - TikTok: confirmed directly from TikTok's own developer FAQ —
//   unaudited apps are forced to SELF_ONLY (private) visibility on every
//   post; a real public post requires TikTok's app audit to complete.
//
// Until Postify's own LinkedIn/TikTok developer apps clear each
// platform's review, connecting an account here works, and a real
// PUBLISHED/private post can be produced for verification — but it will
// not appear on the company's real public page. The UI must say this
// plainly (connect-accounts.tsx), never present these two as
// equivalent-readiness to Facebook/Instagram.
export const REQUIRES_APP_REVIEW: ReadonlySet<SocialPlatform> = new Set(["LINKEDIN", "TIKTOK"]);

export function requiresAppReview(platform: SocialPlatform): boolean {
  return REQUIRES_APP_REVIEW.has(platform);
}

// TikTok's Content Posting API is video-only; the image-posting
// adapters (Facebook, Instagram, LinkedIn) have no video path — see the
// imageBuffer/videoBuffer split in providers/social/types.ts. Shared
// between the server-side createPublishJob validation and the client
// form (create-publish-job-form.tsx) so both agree on which asset type
// a given platform accepts.
export const VIDEO_ONLY_PLATFORMS: ReadonlySet<SocialPlatform> = new Set(["TIKTOK"]);

export function isVideoOnlyPlatform(platform: SocialPlatform | string): boolean {
  return VIDEO_ONLY_PLATFORMS.has(platform as SocialPlatform);
}
