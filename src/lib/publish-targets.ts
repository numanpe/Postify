import "server-only";

import type { Company, SocialPlatform } from "@prisma/client";

import { db } from "@/lib/db";
import { isVideoOnlyPlatform } from "@/lib/providers/social/platform-status";

// Real, human-readable labels for each aggregator — no existing
// mapping elsewhere in the app to reuse (campaign-publish-core.ts's
// ZERNIO_PLATFORM_NAMES is a different concept: this app's platform
// enum -> the aggregator's own platform string, not a display name).
const AGGREGATOR_DISPLAY_NAMES: Record<string, string> = {
  ZERNIO: "Zernio",
  POSTPROXY: "PostProxy",
  UPLOAD_POST: "Upload-Post",
  BUFFER: "Buffer",
};

export interface PublishTarget {
  key: string;
  via: "DIRECT" | "AGGREGATOR";
  platform: SocialPlatform;
  displayName: string;
  // Only set for DIRECT — the aggregator path resolves its own account
  // ID server-side from AggregatorCredential.accountMap, the same way
  // the campaign card's "Publish via Selected Provider" button already
  // does (no per-publish account picker for that path, since a company
  // has at most one connected account per platform per aggregator
  // today — see AggregatorCredential.accountMap's own doc comment).
  socialAccountId?: string;
  acceptsImages: boolean;
  acceptsVideo: boolean;
}

// Real, single source of truth for "what can this company actually
// publish to right now" — merges Direct Meta connections (SocialAccount)
// with the company's single selected aggregator's mapped accounts
// (AggregatorCredential.accountMap), the same two real data sources
// campaign-publish-core.ts already reads, not a new listing mechanism.
// Built for Media Library's Share button (2026-09-02), but deliberately
// not scoped to that feature specifically — any future publish entry
// point can reuse this instead of re-deriving the same merge.
export async function getRealPublishTargets(company: Company): Promise<PublishTarget[]> {
  const targets: PublishTarget[] = [];

  const socialAccounts = await db.socialAccount.findMany({
    where: { companyId: company.id },
    orderBy: { connectedAt: "asc" },
  });
  for (const account of socialAccounts) {
    const videoOnly = isVideoOnlyPlatform(account.platform);
    targets.push({
      key: `direct:${account.id}`,
      via: "DIRECT",
      platform: account.platform,
      displayName: `${account.platform} — ${account.displayName}`,
      socialAccountId: account.id,
      acceptsImages: !videoOnly,
      acceptsVideo: videoOnly,
    });
  }

  if (company.selectedAggregator) {
    const credential = await db.aggregatorCredential.findUnique({
      where: { companyId_provider: { companyId: company.id, provider: company.selectedAggregator } },
    });
    if (credential) {
      const accountMap = credential.accountMap as Record<string, string>;
      const isUploadPost = company.selectedAggregator === "UPLOAD_POST";
      const providerName = AGGREGATOR_DISPLAY_NAMES[company.selectedAggregator] ?? company.selectedAggregator;
      const mappedPlatforms = isUploadPost
        ? (["FACEBOOK", "INSTAGRAM"] as SocialPlatform[]) // Upload-Post groups accounts under one profile (accountMap["_PROFILE_"]), not a per-platform account ID — see campaign-publish-core.ts's isUploadPost branch. Still only ever the platforms this app actually generates content for.
        : (Object.keys(accountMap).filter((key) => key !== "_PROFILE_") as SocialPlatform[]);

      for (const platform of mappedPlatforms) {
        targets.push({
          key: `aggregator:${platform}`,
          via: "AGGREGATOR",
          platform,
          displayName: `${platform} — via ${providerName}`,
          acceptsImages: true,
          acceptsVideo: true,
        });
      }
    }
  }

  return targets;
}
