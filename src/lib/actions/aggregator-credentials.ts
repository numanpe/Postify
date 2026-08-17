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
  const encryptedKey = encryptSecret(apiKey);
  const keyPreview = apiKey.slice(-4);
  const accountMap = parseAccountMap(accountMapRaw);

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
