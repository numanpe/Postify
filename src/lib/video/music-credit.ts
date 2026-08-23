// Every generated video carries one of the 4 bundled CC BY 4.0 tracks
// (see assets/music/README.md, src/lib/video/music.ts) — the license
// requires attribution wherever the work is actually distributed, not
// just in the app's own Settings page (music-credits.tsx covers that
// half). This covers the other half: a real, visible credit line on
// the caption text that actually goes out with a published video.
// Deliberately not run through the i18n dictionary — every token here
// (composer name, domain, license shorthand) is a proper noun/citation
// convention, not prose, so one string reads fine in either locale.
//
// No "server-only" here on purpose, unlike music.ts itself (which
// needs Node fs) — this file is imported from both a server action
// (campaign.ts) and a "use client" form (create-publish-job-form.tsx),
// so it has to stay safe on both sides of the RSC boundary.
export const MUSIC_CREDIT_LINE = "🎵 Music: Kevin MacLeod (incompetech.com), CC BY 4.0";

export function appendMusicCredit(captionText: string): string {
  return `${captionText}\n\n${MUSIC_CREDIT_LINE}`;
}
