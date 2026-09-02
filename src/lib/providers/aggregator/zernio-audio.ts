import "server-only";

import { fetchWithRetry } from "../http";
import { AggregatorProviderError } from "./types";

// Built against docs.zernio.com's real, current OpenAPI spec (fetched
// and verified 2026-09-02, same rigor as zernio-adapter.ts's Provider
// Reality Check) — the ONE real, officially-sourced trending-audio
// capability found for Part 3, after confirming TikTok's official APIs
// (Content Posting, Research, and the full developer product list)
// expose nothing comparable.
//
// This is Zernio's documented proxy of Meta's own Graph API Instagram
// audio catalog (graph.facebook.com) — real licensed music + original
// sounds, including "what's currently trending" (omit `q`). Critically,
// this endpoint returns metadata + a short-lived (~1.5-day) PREVIEW
// url only, never a usable permanent asset: the real license only
// covers attaching a track BY ID REFERENCE when Instagram itself
// publishes a Reel (Meta's own servers mix the audio in using Meta's
// own licensing — see zernio-adapter.ts's platformSpecificData wiring).
// This app never downloads, stores, or bakes the copyrighted audio
// into a rendered file, and never should.
const API_BASE = "https://zernio.com/api/v1";

export interface InstagramAudioAsset {
  audioId: string;
  title: string | null;
  audioType: "music" | "original_sound" | null;
  durationInMs: number | null;
  displayArtist: string | null;
  coverArtworkThumbnailUrl: string | null;
  igUsername: string | null;
  // Ads-boost eligibility only — irrelevant to this app's organic-Reel-
  // only use case (see zernio-adapter.ts's own note); kept for a future
  // "boost this post" feature to gate on, not consumed here.
  isAdsEligible: boolean | null;
}

// GET /v1/accounts/{accountId}/instagram/audio — accountId is the same
// Zernio-internal Instagram account ID already used for publishing (a
// real AggregatorAccount row, platform INSTAGRAM). Requires that account
// be connected to Zernio via Facebook Login specifically; a classic-
// Instagram-Login connection gets a real 400
// (instagram_audio_requires_facebook_login), surfaced honestly below
// rather than an empty result.
export async function searchInstagramAudio(
  apiKey: string,
  accountId: string,
  audioType: "music" | "original_sound",
  query?: string,
): Promise<InstagramAudioAsset[]> {
  const url = new URL(`${API_BASE}/accounts/${encodeURIComponent(accountId)}/instagram/audio`);
  url.searchParams.set("audioType", audioType);
  if (query) url.searchParams.set("q", query);

  const response = await fetchWithRetry(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` } }, 20_000);
  const body = (await response.json().catch(() => ({}))) as { audio?: InstagramAudioAsset[]; error?: { message?: string; code?: string } };

  if (!response.ok) {
    if (body.error?.code === "instagram_audio_requires_facebook_login") {
      throw new AggregatorProviderError(
        "Zernio",
        "This Instagram account is connected with classic Instagram Login — reconnect it choosing Facebook Login to use trending audio.",
      );
    }
    throw new AggregatorProviderError("Zernio", body.error?.message ?? `Couldn't load Instagram's audio catalog (${response.status}).`);
  }
  return body.audio ?? [];
}
