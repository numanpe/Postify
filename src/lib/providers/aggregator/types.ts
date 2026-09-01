import type { SocialAggregatorProvider } from "@prisma/client";

// Provider-agnostic post payload, per the Task 1 spec's own field list —
// every adapter (Zernio today, others once their real API shapes are
// verified) translates this into its own wire format internally.
export interface AggregatorPostInput {
  // Kept even though only Zernio's direct-upload flow uses the raw bytes
  // — Postproxy and Buffer both need a real, publicly-fetchable URL
  // instead (same constraint Instagram's own Graph API has — see
  // src/lib/public-asset-links.ts), which those adapters mint themselves
  // from mediaAssetId immediately before the call and revoke right after.
  mediaAssetId: string;
  mediaBuffer: Buffer;
  mediaMimeType: string;
  mediaKind: "image" | "video";
  captionText: string;
  hashtags: string[];
  // One entry per target platform, each carrying the account ID the user
  // registered on the aggregator's own dashboard (see
  // AggregatorCredential.accountMap) — an adapter that has no account ID
  // for a requested platform should skip it, not guess one.
  platforms: { platform: string; accountId: string }[];
  scheduledTime?: Date;
  // Some providers (Upload-Post) group connected platforms under one
  // named profile rather than a per-platform account ID — sourced from
  // AggregatorCredential.accountMap's reserved "_PROFILE_" key. Unused
  // by every other adapter.
  profileHint?: string;
}

export interface AggregatorPostOutput {
  externalPostId: string;
  // Not every aggregator confirms a per-post URL synchronously — null is
  // honest, never guessed.
  externalPostUrl: string | null;
}

export interface SocialAggregatorAdapter {
  readonly provider: SocialAggregatorProvider;
  publishPost(input: AggregatorPostInput): Promise<AggregatorPostOutput>;
}

// Thrown both for real call failures (bad key, rate limit, provider down)
// and for providers whose real API request/response shape hasn't been
// verified yet — see resolver.ts. Either way this must surface to the
// user, never be swallowed into a fake "published successfully."
export class AggregatorProviderError extends Error {
  constructor(
    public providerName: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "AggregatorProviderError";
  }
}

// Static catalog for the Settings UI — one entry per provider named in
// the spec, each carrying what was actually verified (see the Provider
// Reality Check done before this file was written) rather than the
// spec's unverified claims. `implemented: false` providers still appear
// in "Advanced options" so the UI is honest about what exists without
// silently hiding them.
export interface AggregatorProviderInfo {
  provider: SocialAggregatorProvider;
  displayName: string;
  homepage: string;
  pricingSummary: string;
  implemented: boolean;
  unimplementedReason?: string;
}

export const AGGREGATOR_PROVIDERS: AggregatorProviderInfo[] = [
  {
    provider: "ZERNIO",
    displayName: "Zernio",
    homepage: "https://zernio.com",
    pricingSummary: "First 2 accounts free, then $6/account (3-10), $3/account (11-100), $1/account (101+).",
    implemented: true,
  },
  {
    // Verified: POST https://api.postproxy.dev/api/posts, Bearer auth,
    // JSON body {post:{body,scheduled_at?},profiles:[...],media:[...]},
    // self-serve key at the Postproxy dashboard. Live-tested with a
    // deliberately invalid key against the real endpoint — got a clean
    // {"error":"Invalid API key"} 401, confirming the shape is real.
    provider: "POSTPROXY",
    displayName: "Postproxy",
    homepage: "https://postproxy.dev",
    pricingSummary: "Free tier: 10 posts/mo. Paid plans start at $17/mo.",
    implemented: true,
  },
  {
    // Endpoint confirmed real: POST https://api.upload-post.com/api/upload_photos,
    // "Authorization: Apikey <key>", multipart/form-data — live-probed
    // with an invalid key and got a real, structured
    // {"success":false,"message":"Invalid API key format"} 401, proving
    // the endpoint exists and returns honest, specific errors (not a
    // silent failure) rather than a guess-and-hope integration. The
    // exact field names below (user/platform[]/photos[]/title/
    // scheduled_date) are NOT independently confirmed for this specific
    // endpoint — they're inferred from the sibling video-upload
    // endpoint's fully-confirmed shape (same API, documented parallel
    // convention: "user"/"platform[]"/"title"/"scheduled_date", with
    // "photos[]" following "video"'s documented pattern of accepting
    // either a binary file or a public URL). MEDIUM confidence, same
    // class as buffer-adapter.ts's field-name risk — if wrong, this
    // API's own confirmed real error messages surface honestly rather
    // than a fake success.
    provider: "UPLOAD_POST",
    displayName: "Upload-Post",
    homepage: "https://upload-post.com",
    pricingSummary: "Free tier available. Paid plans reported to start around $16/mo.",
    implemented: true,
  },
  {
    // Verified: self-serve personal API key at
    // publish.buffer.com/settings/api (no OAuth/partner approval needed
    // for this BYOK use case — the OAuth gating reported elsewhere is
    // for third-party apps acting on OTHER users' accounts, not this).
    // Endpoint https://api.buffer.com (GraphQL), Bearer auth — live-tested
    // with an invalid key and got a clean GraphQL UNAUTHENTICATED error,
    // confirming the endpoint/auth shape. The createPost mutation's exact
    // input field names come from a single documentation source (not
    // independently cross-verified) — flagged in buffer-adapter.ts.
    provider: "BUFFER",
    displayName: "Buffer",
    homepage: "https://buffer.com",
    pricingSummary: "Per-channel pricing on Buffer's own plans; API terms are separate.",
    implemented: true,
  },
];
