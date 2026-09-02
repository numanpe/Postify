import type { SocialPlatform } from "@prisma/client";

import type { Dictionary } from "@/lib/i18n/dictionaries";

// Split out of publish-targets.ts (2026-09-03): that file starts with
// `import "server-only"`, so pulling platformLabel from it into a
// Client Component (Settings' AccountMapStatus) broke the whole page —
// same RSC-boundary bug class as the two earlier real ones. This module
// has no server-only dependency, just a dictionary lookup, so it's safe
// for both server and client callers. publish-targets.ts re-exports it
// so its existing server-side callers (inbox.ts, calendar-item-card.tsx)
// don't need to change their import.
const PLATFORM_LABEL_KEYS: Record<SocialPlatform, keyof Dictionary["publish"]> = {
  FACEBOOK: "platformFacebook",
  INSTAGRAM: "platformInstagram",
  LINKEDIN: "platformLinkedIn",
  TIKTOK: "platformTikTok",
};

export function platformLabel(dict: Dictionary, platform: SocialPlatform): string {
  const key = PLATFORM_LABEL_KEYS[platform];
  return key ? (dict.publish[key] as string) : platform;
}
