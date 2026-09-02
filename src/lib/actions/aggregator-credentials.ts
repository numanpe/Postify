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

// Real UX gap found live (2026-09-03), fixed here for Upload-Post only —
// the one real provider that still genuinely uses accountMap (its
// reserved "_PROFILE_" key; see AggregatorCredential.accountMap's own
// doc comment). Every other provider's account IDs now live in real
// AggregatorAccount rows, managed by the CRUD actions below instead.
// Once a credential is saved, the Settings form used to collapse to
// just "•••• 1762" + Remove — no way to see whether a profile name was
// actually set, and no way to add/fix it afterward short of deleting
// the whole credential and re-typing the API key. This action lets an
// existing credential's accountMap be added/fixed in place, without
// touching the encrypted key.
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

const SOCIAL_PLATFORM_VALUES = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "TIKTOK"] as [string, ...string[]];

const AddAccountSchema = z.object({
  credentialId: z.string().min(1),
  platform: z.enum(SOCIAL_PLATFORM_VALUES),
  accountId: z.string().trim().min(1, "Enter the real account ID from your provider's dashboard.").max(200),
  label: z.string().trim().min(1, "Give this account a short label so it's distinguishable from others.").max(80),
});

// 2026-09-03 multi-account redesign — Part 2/3: a company can have more
// than one real connected account on the same platform (e.g. two real
// Facebook Pages), which the old single accountMap field genuinely
// couldn't represent (confirmed by reading every real consumer — see
// project_zernio_accountmap_edit_in_settings). Each add is one real
// AggregatorAccount row; the first account added for a given platform on
// this credential becomes that platform's default automatically (used by
// the CampaignItem/recurring-plan path, which has no per-publish account
// picker) — see AggregatorAccount.isDefault's own doc comment.
export async function addAggregatorAccount(
  _prevState: AggregatorCredentialState,
  formData: FormData,
): Promise<AggregatorCredentialState> {
  const { company } = await requireCompany();

  const parsed = AddAccountSchema.safeParse({
    credentialId: formData.get("credentialId"),
    platform: formData.get("platform"),
    accountId: formData.get("accountId"),
    label: formData.get("label"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { credentialId, platform, accountId, label } = parsed.data;

  // Multi-tenant isolation: scope by companyId, never trust the
  // client-supplied credentialId alone — see CLAUDE.md's data-layer rule.
  const credential = await db.aggregatorCredential.findFirst({
    where: { id: credentialId, companyId: company.id },
    include: { accounts: { where: { platform: platform as never } } },
  });
  if (!credential) {
    return { error: "That credential no longer exists." };
  }

  const existing = credential.accounts.find((a) => a.accountId === accountId);
  if (existing) {
    return { error: "That account ID is already added for this platform." };
  }

  await db.aggregatorAccount.create({
    data: {
      credentialId,
      platform: platform as never,
      accountId,
      label,
      isDefault: credential.accounts.length === 0,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/media");
}

const RenameAccountSchema = z.object({
  accountId: z.string().min(1),
  label: z.string().trim().min(1, "Give this account a short label.").max(80),
});

export async function renameAggregatorAccount(
  _prevState: AggregatorCredentialState,
  formData: FormData,
): Promise<AggregatorCredentialState> {
  const { company } = await requireCompany();

  const parsed = RenameAccountSchema.safeParse({
    accountId: formData.get("accountId"),
    label: formData.get("label"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Company-scoped via the credential relation, same isolation pattern
  // as every other mutation in this file.
  const result = await db.aggregatorAccount.updateMany({
    where: { id: parsed.data.accountId, credential: { companyId: company.id } },
    data: { label: parsed.data.label },
  });
  if (result.count === 0) {
    return { error: "That account no longer exists." };
  }

  revalidatePath("/settings");
}

export async function removeAggregatorAccount(accountId: string): Promise<void> {
  const { company } = await requireCompany();

  const account = await db.aggregatorAccount.findFirst({
    where: { id: accountId, credential: { companyId: company.id } },
  });
  if (!account) return;

  await db.aggregatorAccount.delete({ where: { id: account.id } });

  // If the removed account was its platform's default, promote another
  // real account on the same platform (if any real one is left) — a
  // platform with connected accounts should never be left with none
  // marked default, since the CampaignItem/recurring-plan path relies on
  // that to pick which one to use.
  if (account.isDefault) {
    const nextAccount = await db.aggregatorAccount.findFirst({
      where: { credentialId: account.credentialId, platform: account.platform },
      orderBy: { createdAt: "asc" },
    });
    if (nextAccount) {
      await db.aggregatorAccount.update({ where: { id: nextAccount.id }, data: { isDefault: true } });
    }
  }

  revalidatePath("/settings");
  revalidatePath("/media");
}

export async function setDefaultAggregatorAccount(accountId: string): Promise<void> {
  const { company } = await requireCompany();

  const account = await db.aggregatorAccount.findFirst({
    where: { id: accountId, credential: { companyId: company.id } },
  });
  if (!account) return;

  // Exactly one default per (credentialId, platform), enforced here in
  // application code — same "exactly one X" pattern this app already
  // uses for a company's own selectedAggregator, not a new concept.
  await db.$transaction([
    db.aggregatorAccount.updateMany({
      where: { credentialId: account.credentialId, platform: account.platform },
      data: { isDefault: false },
    }),
    db.aggregatorAccount.update({ where: { id: account.id }, data: { isDefault: true } }),
  ]);

  revalidatePath("/settings");
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
