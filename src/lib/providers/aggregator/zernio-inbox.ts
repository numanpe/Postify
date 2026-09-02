import "server-only";

import type { SocialPlatform } from "@prisma/client";
import { fetchWithRetry } from "../http";
import { AggregatorProviderError } from "./types";

// Built against docs.zernio.com's real, current OpenAPI spec (fetched
// and verified 2026-09-02, same rigor as zernio-adapter.ts's own
// Provider Reality Check) — Part 2's "Using Zernio's messaging
// capability" premise checked against the actual documented surface,
// not assumed to exist.
const API_BASE = "https://zernio.com/api/v1";

// Real, verified per-platform support matrix — narrower than what the
// spec/user request assumed. Comments: Facebook, Instagram, Twitter/X,
// Bluesky, Threads, YouTube, LinkedIn, Reddit. DMs: Facebook, Instagram,
// Twitter/X, Bluesky, Reddit, Telegram. Of THIS app's 4 SocialPlatform
// values, that means:
//   - Comments: Facebook, Instagram, LinkedIn (not TikTok)
//   - DMs: Facebook, Instagram only (not LinkedIn, not TikTok)
// getInboxItems (src/lib/inbox.ts) uses these to decide which connected
// accounts to even query, rather than calling Zernio for a platform it
// has already told us it can't serve and surfacing a confusing error.
export const ZERNIO_COMMENT_PLATFORMS: Partial<Record<SocialPlatform, string>> = {
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  LINKEDIN: "linkedin",
};

export const ZERNIO_DM_PLATFORMS: Partial<Record<SocialPlatform, string>> = {
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
};

// Thrown specifically for the real 403 "Inbox addon required" /
// resource-group-disabled responses the spec documents — distinct from
// AggregatorProviderError so callers can show "this Zernio plan/key
// doesn't have inbox access" rather than a generic failure message.
export class ZernioInboxUnavailableError extends AggregatorProviderError {
  constructor(message: string) {
    super("Zernio", message);
    this.name = "ZernioInboxUnavailableError";
  }
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function zernioGet<T>(apiKey: string, path: string, params: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetchWithRetry(url.toString(), { headers: authHeaders(apiKey) }, 20_000);
  if (response.status === 403) {
    const body = await response.text().catch(() => "");
    throw new ZernioInboxUnavailableError(
      /messages.*resource group|resource group.*disabled/i.test(body)
        ? "This Zernio API key doesn't have the Messages/Comments permission enabled — enable it in the Zernio dashboard's API keys tab."
        : "This Zernio plan doesn't include the Inbox add-on.",
    );
  }
  if (!response.ok) {
    throw new AggregatorProviderError("Zernio", `Zernio inbox request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export interface ZernioCommentedPost {
  id: string;
  platform: string;
  accountId: string;
  content: string;
  permalink: string | null;
  createdTime: string;
  commentCount: number;
  isAd: boolean;
}

export interface ZernioComment {
  id: string;
  message: string;
  createdTime: string;
  from: { id: string; name: string; username?: string };
  platform: string;
  url: string | null;
  canReply: boolean;
}

export interface ZernioConversation {
  id: string;
  platform: string;
  accountId: string;
  accountUsername: string;
  participantId: string;
  participantName: string;
  lastMessage: string;
  updatedTime: string;
  unreadCount: number | null;
  url: string | null;
}

interface ZernioMeta {
  accountsFailed: number;
  failedAccounts: { accountId: string; platform: string; error: string }[];
  accountsSkipped: { accountId: string; platform: string }[];
}

export interface ZernioInboxFailure {
  accountId: string;
  platform: string;
  error: string;
}

// GET /v1/inbox/comments — real posts-with-comment-counts, aggregated
// across every account connected on this Zernio key (not scoped to
// this app's accountIds server-side; callers filter to their own known
// accounts — see getInboxItems). Capped at `limit` most recent.
export async function listCommentedPosts(
  apiKey: string,
  limit: number,
): Promise<{ posts: ZernioCommentedPost[]; failures: ZernioInboxFailure[] }> {
  const data = await zernioGet<{ data: ZernioCommentedPost[]; meta: ZernioMeta }>(apiKey, "/inbox/comments", {
    limit: String(limit),
    sortBy: "date",
    sortOrder: "desc",
  });
  return { posts: data.data.filter((p) => !p.isAd), failures: data.meta.failedAccounts ?? [] };
}

// GET /v1/inbox/comments/{postId} — the actual comment text for one
// post, capped at `limit` (top-level only; replies aren't fetched, same
// scope limit as not building a full nested-thread UI for a v1).
export async function getPostComments(apiKey: string, postId: string, accountId: string, limit: number): Promise<ZernioComment[]> {
  const data = await zernioGet<{ comments: ZernioComment[] }>(apiKey, `/inbox/comments/${encodeURIComponent(postId)}`, {
    accountId,
    limit: String(limit),
  });
  return data.comments;
}

// POST /v1/inbox/comments/{postId} — reply to a specific comment (or to
// the post itself if commentId is omitted). Never called except from an
// explicit user Send action (src/lib/actions/inbox.ts) — no automated
// caller anywhere in this app.
export async function replyToComment(
  apiKey: string,
  postId: string,
  accountId: string,
  message: string,
  commentId: string,
): Promise<void> {
  const response = await fetchWithRetry(
    `${API_BASE}/inbox/comments/${encodeURIComponent(postId)}`,
    { method: "POST", headers: authHeaders(apiKey), body: JSON.stringify({ accountId, message, commentId }) },
    20_000,
  );
  if (response.status === 403) {
    throw new ZernioInboxUnavailableError("This Zernio plan/key doesn't have permission to reply to comments.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new AggregatorProviderError("Zernio", body.error ?? `Zernio comment reply failed (${response.status}).`);
  }
}

// GET /v1/inbox/conversations — real DM threads, same
// aggregated-across-account shape as listCommentedPosts.
export async function listConversations(
  apiKey: string,
  limit: number,
): Promise<{ conversations: ZernioConversation[]; failures: ZernioInboxFailure[] }> {
  const data = await zernioGet<{ data: ZernioConversation[]; meta: ZernioMeta }>(apiKey, "/inbox/conversations", {
    limit: String(limit),
    sortOrder: "desc",
  });
  return { conversations: data.data, failures: data.meta.failedAccounts ?? [] };
}

// POST /v1/inbox/conversations/{conversationId}/messages — send a DM
// reply. Same "only from an explicit Send click" rule as
// replyToComment above.
export async function sendConversationMessage(apiKey: string, conversationId: string, accountId: string, message: string): Promise<void> {
  const response = await fetchWithRetry(
    `${API_BASE}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", headers: authHeaders(apiKey), body: JSON.stringify({ accountId, message }) },
    20_000,
  );
  if (response.status === 403) {
    throw new ZernioInboxUnavailableError("This Zernio plan/key doesn't have permission to send messages.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new AggregatorProviderError("Zernio", body.error ?? `Zernio message send failed (${response.status}).`);
  }
}
