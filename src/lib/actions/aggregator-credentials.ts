"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";
import { AGGREGATOR_PROVIDERS } from "@/lib/providers/aggregator/types";

export type AggregatorCredentialState = { error: string } | undefined;

const PROVIDER_VALUES = AGGREGATOR_PROVIDERS.map((p) => p.provider) as [string, ...string[]];
const PROVIDER_ENUM = z.enum(PROVIDER_VALUES);

const SaveSchema = z.object({
  provider: PROVIDER_ENUM,
  apiKey: z.string().trim().min(10, "That doesn't look like a valid API key.").max(500),
  // "FACEBOOK:acc_123,INSTAGRAM:acc_456" — one accountId per targeted
  // platform, in the aggregator's own ID format. Kept as a single
  // freeform field rather than N separate inputs so this form works
  // regardless of which platforms a company targets.
  accountMapRaw: z.string().trim().max(2000).optional(),
});

function parseAccountMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const map: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [platform, accountId] = pair.split(":").map((s) => s.trim());
    if (platform && accountId) {
      map[platform.toUpperCase()] = accountId;
    }
  }
  return map;
}

export async function saveAggregatorCredential(
  _prevState: AggregatorCredentialState,
  formData: FormData,
): Promise<AggregatorCredentialState> {
  const { company } = await requireCompany();

  const parsed = SaveSchema.safeParse({
    provider: formData.get("provider"),
    apiKey: formData.get("apiKey"),
    accountMapRaw: formData.get("accountMapRaw") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { provider, apiKey, accountMapRaw } = parsed.data;
  const accountMap = parseAccountMap(accountMapRaw);

  // Real bug found live (2026-09-03): parseAccountMap silently drops
  // any pair that doesn't match PLATFORM:accountId (no colon, wrong
  // separator, etc.) with zero feedback — a company could end up with
  // a real, saved, selected credential and an empty accountMap, which
  // getRealPublishTargets then correctly resolves to zero real
  // targets. Media Library's Share modal used to render that
  // identically to "nothing connected at all," pointing the user at
  // /publish — which doesn't even list aggregator connections — instead
  // of the real fix (this exact field). A genuinely blank field is
  // still allowed through unblocked (adding account IDs later is a
  // real, legitimate flow); only real typed content that failed to
  // parse into anything usable is rejected here, at the source, rather
  // than saved into a silently broken state.
  if (accountMapRaw && accountMapRaw.trim().length > 0 && Object.keys(accountMap).length === 0) {
    return {
      error:
        "Couldn't read any platform account IDs from that — check the format (e.g. FACEBOOK:acc_123, INSTAGRAM:acc_456).",
    };
  }

  const encryptedKey = encryptSecret(apiKey);
  const keyPreview = apiKey.slice(-4);

  await db.aggregatorCredential.upsert({
    where: { companyId_provider: { companyId: company.id, provider: provider as never } },
    create: { companyId: company.id, provider: provider as never, encryptedKey, keyPreview, accountMap },
    update: { encryptedKey, keyPreview, accountMap },
  });

  // Saving a credential is a deliberate, explicit signal the user wants
  // to actually use this provider now — switches both the mode and the
  // active provider, the same way choosing "Use this method" does below.
  await db.company.update({
    where: { id: company.id },
    data: { publishingMode: "AGGREGATOR", selectedAggregator: provider as never },
  });

  revalidatePath("/settings");
}

const UpdateAccountMapSchema = z.object({
  credentialId: z.string().min(1),
  // Unlike the initial save, this form exists specifically for a
  // credential that already has zero (or broken) account IDs — a blank
  // submission here would just be a confusing no-op, so it's required.
  accountMapRaw: z.string().trim().min(1, "Enter at least one platform account ID.").max(2000),
});

// Real UX gap found live (2026-09-03): once a credential is saved, the
// Settings form collapsed to just "•••• 1762" + Remove — no way to see
// whether accountMap actually has anything in it, and no way to add or
// fix account IDs afterward short of deleting the whole credential and
// re-typing the API key from scratch. That's exactly how a real user
// (confirmed via direct DB evidence on two of this account's own real
// companies) can save a real key, see "Currently in use," and reasonably
// believe they're fully connected while accountMap stays {}. This action
// lets an existing credential's accountMap be added/fixed in place,
// without touching the encrypted key.
export async function updateAggregatorAccountMap(
  _prevState: AggregatorCredentialState,
  formData: FormData,
): Promise<AggregatorCredentialState> {
  const { company } = await requireCompany();

  const parsed = UpdateAccountMapSchema.safeParse({
    credentialId: formData.get("credentialId"),
    accountMapRaw: formData.get("accountMapRaw"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { credentialId, accountMapRaw } = parsed.data;
  const accountMap = parseAccountMap(accountMapRaw);
  if (Object.keys(accountMap).length === 0) {
    return {
      error:
        "Couldn't read any platform account IDs from that — check the format (e.g. FACEBOOK:acc_123, INSTAGRAM:acc_456).",
    };
  }

  // Multi-tenant isolation: scope by companyId, never trust the
  // client-supplied credentialId alone — see CLAUDE.md's data-layer rule.
  const result = await db.aggregatorCredential.updateMany({
    where: { id: credentialId, companyId: company.id },
    data: { accountMap },
  });
  if (result.count === 0) {
    return { error: "That credential no longer exists." };
  }

  revalidatePath("/settings");
  revalidatePath("/media");
}

export async function removeAggregatorCredential(credentialId: string): Promise<void> {
  const { company } = await requireCompany();

  await db.aggregatorCredential.deleteMany({ where: { id: credentialId, companyId: company.id } });
  revalidatePath("/settings");
}

const ModeSchema = z.enum(["MANUAL", "AGGREGATOR", "DIRECT_API"]);

export async function setPublishingMode(formData: FormData): Promise<void> {
  const { company } = await requireCompany();

  const parsed = ModeSchema.safeParse(formData.get("mode"));
  if (!parsed.success) return;

  // Optional — only present on the "Use this method" button next to an
  // already-saved aggregator credential, so switching between e.g. an
  // existing Zernio key and an existing Postproxy key actually changes
  // which one publishes, not just the mode.
  const providerRaw = formData.get("provider");
  const providerParsed = PROVIDER_ENUM.safeParse(providerRaw);

  await db.company.update({
    where: { id: company.id },
    data: {
      publishingMode: parsed.data,
      ...(providerParsed.success ? { selectedAggregator: providerParsed.data as never } : {}),
    },
  });
  revalidatePath("/settings");
}
