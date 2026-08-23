"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";

export type ProviderCredentialState = { error: string } | undefined;

const SaveSchema = z.object({
  provider: z.enum(["OPENAI", "ANTHROPIC", "ELEVENLABS", "FISH_AUDIO", "GEMINI"]),
  apiKey: z.string().trim().min(10, "That doesn't look like a valid API key.").max(500),
});

export async function saveProviderCredential(
  _prevState: ProviderCredentialState,
  formData: FormData,
): Promise<ProviderCredentialState> {
  const { company } = await requireCompany();

  const parsed = SaveSchema.safeParse({
    provider: formData.get("provider"),
    apiKey: formData.get("apiKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { provider, apiKey } = parsed.data;
  const encryptedKey = encryptSecret(apiKey);
  const keyPreview = apiKey.slice(-4);

  await db.providerCredential.upsert({
    where: { companyId_provider: { companyId: company.id, provider } },
    create: { companyId: company.id, provider, encryptedKey, keyPreview },
    update: { encryptedKey, keyPreview },
  });

  revalidatePath("/settings");
}

export async function removeProviderCredential(credentialId: string): Promise<void> {
  const { company } = await requireCompany();

  // Ownership check: only remove a credential that actually belongs to
  // the caller's company.
  await db.providerCredential.deleteMany({
    where: { id: credentialId, companyId: company.id },
  });

  revalidatePath("/settings");
}
