import "server-only";

import type { Company, SocialPlatform } from "@prisma/client";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import {
  ZERNIO_COMMENT_PLATFORMS,
  ZERNIO_DM_PLATFORMS,
  ZernioInboxUnavailableError,
  listCommentedPosts,
  getPostComments,
  listConversations,
} from "@/lib/providers/aggregator/zernio-inbox";
import { AggregatorProviderError } from "@/lib/providers/aggregator/types";

// Real posts/accounts fetched per inbox load, capped for the same
// quota/latency reasons every other "list from a real external API"
// surface in this app caps its fetch (media pickers, galleries) — a
// live dashboard, not a full historical sync.
const MAX_COMMENTED_POSTS = 8;
const MAX_COMMENTS_PER_POST = 5;
const MAX_CONVERSATIONS = 15;

export type InboxReplyRef =
  | { kind: "comment"; postId: string; commentId: string; accountId: string; platform: SocialPlatform }
  | { kind: "dm"; conversationId: string; accountId: string; platform: SocialPlatform };

export interface InboxItem {
  id: string;
  kind: "comment" | "dm";
  platform: SocialPlatform;
  authorName: string;
  text: string;
  createdAt: Date;
  url: string | null;
  replyRef: InboxReplyRef;
}

export interface InboxAccountFailure {
  platform: string;
  error: string;
}

export type InboxResult =
  | { status: "not_connected" }
  | { status: "unavailable"; reason: string }
  | {
      status: "ok";
      items: InboxItem[];
      // Real platforms this company has connected on Zernio that its
      // inbox simply doesn't cover (TikTok for both, LinkedIn for DMs) —
      // shown honestly in the UI rather than silently omitted, per the
      // spec's own "handle the case Zernio doesn't support this platform,
      // degrade gracefully" requirement.
      unsupportedPlatforms: SocialPlatform[];
      accountFailures: InboxAccountFailure[];
    };

function reversePlatformMap(map: Partial<Record<SocialPlatform, string>>): Record<string, SocialPlatform> {
  const reversed: Record<string, SocialPlatform> = {};
  for (const [ours, zernio] of Object.entries(map)) {
    if (zernio) reversed[zernio] = ours as SocialPlatform;
  }
  return reversed;
}

const COMMENT_PLATFORM_REVERSE = reversePlatformMap(ZERNIO_COMMENT_PLATFORMS);
const DM_PLATFORM_REVERSE = reversePlatformMap(ZERNIO_DM_PLATFORMS);

// Real, single source of truth for Media Library's Share-button-style
// "what can this company actually see/do right now" question, applied
// to Part 2's inbox instead of publishing. Only ever reads from Zernio
// (the one aggregator whose real inbox API was verified — see
// zernio-inbox.ts's own doc comment); a company on Postproxy/Buffer/
// Upload-Post or Direct-only publishing genuinely has no inbox source
// today, surfaced as "not_connected", never a fake empty inbox.
export async function getInboxItems(company: Company): Promise<InboxResult> {
  if (company.selectedAggregator !== "ZERNIO") {
    return { status: "not_connected" };
  }

  const credential = await db.aggregatorCredential.findUnique({
    where: { companyId_provider: { companyId: company.id, provider: "ZERNIO" } },
    include: { accounts: true },
  });
  if (!credential) {
    return { status: "not_connected" };
  }

  // 2026-09-03 multi-account redesign: a platform can now have more than
  // one real connected account, so these are built from every real
  // AggregatorAccount row rather than one accountId per platform — the
  // rest of this function already operates on Sets of accountIds, so a
  // platform contributing 2 real accounts here just works.
  const connectedPlatforms = [...new Set(credential.accounts.map((a) => a.platform))];
  const commentAccountIds = new Set(
    credential.accounts.filter((a) => ZERNIO_COMMENT_PLATFORMS[a.platform]).map((a) => a.accountId),
  );
  const dmAccountIds = new Set(
    credential.accounts.filter((a) => ZERNIO_DM_PLATFORMS[a.platform]).map((a) => a.accountId),
  );
  const unsupportedPlatforms = connectedPlatforms.filter((p) => !ZERNIO_COMMENT_PLATFORMS[p] && !ZERNIO_DM_PLATFORMS[p]);

  if (commentAccountIds.size === 0 && dmAccountIds.size === 0) {
    // Every connected platform is one Zernio's inbox doesn't cover at
    // all (e.g. only TikTok connected) — a real, honest "nothing to show
    // here" state, distinct from a fetch failure.
    return { status: "ok", items: [], unsupportedPlatforms, accountFailures: [] };
  }

  try {
    // Real bug found live during verification: decryptSecret used to run
    // OUTSIDE this try block, so a malformed/undecryptable credential
    // (e.g. after an ENCRYPTION_KEY rotation) threw an uncaught error
    // and crashed the whole /inbox page with a 500 instead of the
    // honest "unavailable" state every other real failure here already
    // gets. Moved inside so it degrades the same way.
    const apiKey = decryptSecret(credential.encryptedKey);
    const items: InboxItem[] = [];
    const accountFailures: InboxAccountFailure[] = [];

    if (commentAccountIds.size > 0) {
      const { posts, failures } = await listCommentedPosts(apiKey, MAX_COMMENTED_POSTS * 2);
      accountFailures.push(...failures);
      const relevantPosts = posts.filter((p) => commentAccountIds.has(p.accountId) && p.commentCount > 0).slice(0, MAX_COMMENTED_POSTS);

      for (const post of relevantPosts) {
        const platform = COMMENT_PLATFORM_REVERSE[post.platform];
        if (!platform) continue;
        const comments = await getPostComments(apiKey, post.id, post.accountId, MAX_COMMENTS_PER_POST);
        for (const comment of comments) {
          if (!comment.canReply) continue;
          items.push({
            id: `comment:${post.id}:${comment.id}`,
            kind: "comment",
            platform,
            authorName: comment.from.name || comment.from.username || "Someone",
            text: comment.message,
            createdAt: new Date(comment.createdTime),
            url: comment.url,
            replyRef: { kind: "comment", postId: post.id, commentId: comment.id, accountId: post.accountId, platform },
          });
        }
      }
    }

    if (dmAccountIds.size > 0) {
      const { conversations, failures } = await listConversations(apiKey, MAX_CONVERSATIONS);
      accountFailures.push(...failures);
      for (const convo of conversations) {
        if (!dmAccountIds.has(convo.accountId)) continue;
        const platform = DM_PLATFORM_REVERSE[convo.platform];
        if (!platform) continue;
        items.push({
          id: `dm:${convo.id}`,
          kind: "dm",
          platform,
          authorName: convo.participantName || "Someone",
          text: convo.lastMessage,
          createdAt: new Date(convo.updatedTime),
          url: convo.url,
          replyRef: { kind: "dm", conversationId: convo.id, accountId: convo.accountId, platform },
        });
      }
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { status: "ok", items, unsupportedPlatforms, accountFailures };
  } catch (error) {
    if (error instanceof ZernioInboxUnavailableError) {
      return { status: "unavailable", reason: error.message };
    }
    if (error instanceof AggregatorProviderError) {
      return { status: "unavailable", reason: error.message };
    }
    // Real, unexpected failure (e.g. a credential that fails to decrypt
    // after an ENCRYPTION_KEY rotation) — logged server-side so it's
    // discoverable, but degrades the page honestly rather than crashing
    // it. Error.message is safe to show here: every message this
    // module's own real dependencies throw (decryptSecret, fetch
    // failures) is an operational description, never raw credential
    // material.
    console.error(`[inbox] getInboxItems failed for company ${company.id}:`, error);
    return { status: "unavailable", reason: error instanceof Error ? error.message : "Couldn't load the inbox." };
  }
}
