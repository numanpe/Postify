"use server";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { searchInstagramAudio, type InstagramAudioAsset } from "@/lib/providers/aggregator/zernio-audio";
import { AggregatorProviderError } from "@/lib/providers/aggregator/types";

export type InstagramAudioSearchState = { error: string } | { results: InstagramAudioAsset[] };

// Part 3's real trending-audio browse — called directly from a client
// component (not via a <form action>, since it lives nested inside the
// Share button's own outer form and a <form> can't nest another one).
// Never called except by an explicit user interaction (opening the
// picker, typing a search, switching music/original-sound) — this is
// read-only and never itself publishes or attaches anything.
export async function searchTrendingInstagramAudioAction(audioType: "music" | "original_sound", query?: string): Promise<InstagramAudioSearchState> {
  const { company } = await requireCompany();

  if (company.selectedAggregator !== "ZERNIO") {
    return { error: "Connect Zernio in Settings to browse trending Instagram audio." };
  }
  const credential = await db.aggregatorCredential.findUnique({
    where: { companyId_provider: { companyId: company.id, provider: "ZERNIO" } },
    include: { accounts: { where: { platform: "INSTAGRAM" } } },
  });
  if (!credential) {
    return { error: "Connect Zernio in Settings to browse trending Instagram audio." };
  }
  // 2026-09-03 multi-account redesign: an Instagram account's real
  // accountId now lives in AggregatorAccount, not accountMap.INSTAGRAM.
  // This picker has no per-account context (it's a search, not a
  // publish), so it uses the platform's marked default account — the
  // same real account a scheduled/automatic publish to Instagram would
  // use if the user didn't pick a specific one via Share.
  const account = credential.accounts.find((a) => a.isDefault) ?? credential.accounts[0];
  if (!account) {
    return { error: "Connect an Instagram account through Zernio to browse trending audio." };
  }
  const accountId = account.accountId;

  try {
    const apiKey = decryptSecret(credential.encryptedKey);
    const results = await searchInstagramAudio(apiKey, accountId, audioType, query);
    return { results };
  } catch (error) {
    if (error instanceof AggregatorProviderError) {
      return { error: error.message };
    }
    // Same graceful-degrade discipline as getInboxItems (Part 2) — a
    // real unexpected failure (e.g. an undecryptable credential) never
    // crashes the Share modal, just reports honestly.
    console.error(`[instagram-audio] search failed for company ${company.id}:`, error);
    return { error: "Couldn't load Instagram's audio catalog right now." };
  }
}
