import type { SocialPlatform } from "@prisma/client";

// Real, current (Dec 2025) per-platform guidance, verified via WebSearch
// before writing this — not invented rules of thumb. Instagram's is a
// genuine hard platform cap (announced by Instagram's own @Creators
// account, Dec 18 2025): posts over 5 hashtags get the excess stripped
// or suffer real Explore/Reels distribution suppression, not just a
// "best practice" a business could safely ignore. The others are real
// current marketing guidance, not platform-enforced limits.
const PLATFORM_HASHTAG_CAP: Record<SocialPlatform, number> = {
  INSTAGRAM: 5, // Hard platform cap since Dec 2025 — never exceed.
  TIKTOK: 5,
  LINKEDIN: 5, // LinkedIn's culture favors few, professional tags — 5 is the real upper bound, not a target.
  FACEBOOK: 3, // Hashtags have minimal real discovery value on Facebook.
};

const DEFAULT_CAP = 5;

// When one item targets multiple platforms at once (this app publishes
// the SAME hashtag set everywhere an item is posted — there's no real
// per-platform hashtag variant), the most restrictive real limit among
// them wins. Publishing a 5-hashtag Instagram-safe set to Facebook too
// is fine (Facebook has no real hard cap, just weaker discovery value
// past a few); publishing a Facebook-sized 3-tag set to Instagram is
// also fine — under-using Instagram's room isn't a real problem the way
// exceeding a hard cap is.
export function hashtagCapForPlatforms(platforms: SocialPlatform[]): number {
  if (platforms.length === 0) return DEFAULT_CAP;
  return Math.min(...platforms.map((p) => PLATFORM_HASHTAG_CAP[p] ?? DEFAULT_CAP));
}
