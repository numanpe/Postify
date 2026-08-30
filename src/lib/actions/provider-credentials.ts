"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";

export type ProviderCredentialState = { error: string } | undefined;

const ProviderEnum = z.enum(["OPENAI", "ANTHROPIC", "ELEVENLABS", "FISH_AUDIO", "GEMINI"]);

const SaveSchema = z.object({
  provider: ProviderEnum,
  apiKey: z.string().trim().min(10, "That doesn't look like a valid API key.").max(500),
  // Defaults to company-only: the pre-existing, still-current behavior
  // for every user who never sees or touches this field (single-company
  // users don't get the choice at all — see provider-credential-form.tsx).
  scope: z.enum(["SHARED", "COMPANY_ONLY"]).default("COMPANY_ONLY"),
});

export async function saveProviderCredential(
  _prevState: ProviderCredentialState,
  formData: FormData,
): Promise<ProviderCredentialState> {
  const { user, company } = await requireCompany();

  const parsed = SaveSchema.safeParse({
    provider: formData.get("provider"),
    apiKey: formData.get("apiKey"),
    scope: formData.get("scope") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { provider, apiKey, scope } = parsed.data;
  const encryptedKey = encryptSecret(apiKey);
  const keyPreview = apiKey.slice(-4);

  if (scope === "SHARED") {
    await db.$transaction([
      db.sharedProviderCredential.upsert({
        where: { userId_provider: { userId: user.id, provider } },
        create: { userId: user.id, provider, encryptedKey, keyPreview },
        update: { encryptedKey, keyPreview },
      }),
      // Without this, a stale company-only row for the same provider
      // would keep winning in every resolver (company-specific always
      // takes priority over shared) — the user would save a shared key
      // and see no change for the company they saved it from.
      db.providerCredential.deleteMany({
        where: { companyId: company.id, provider },
      }),
    ]);
  } else {
    await db.providerCredential.upsert({
      where: { companyId_provider: { companyId: company.id, provider } },
      create: { companyId: company.id, provider, encryptedKey, keyPreview },
      update: { encryptedKey, keyPreview },
    });
  }

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

// Promotes an existing company-only credential to shared, without
// making the user re-enter the secret — the encrypted bytes move as
// opaque ciphertext (same CREDENTIALS_ENCRYPTION_KEY either way), never
// decrypted here. Any shared credential this user already has for the
// same provider is replaced, since SharedProviderCredential is one row
// per (user, provider) — the settings UI must warn about this before
// calling it, since it affects every other company that was relying on
// the previous shared key.
export async function promoteProviderCredentialToShared(credentialId: string): Promise<void> {
  const { user, company } = await requireCompany();

  // No-op on a stale/foreign id — same "ownership check, silently
  // no-op if it doesn't match" contract removeProviderCredential
  // already uses right above.
  const source = await db.providerCredential.findFirst({
    where: { id: credentialId, companyId: company.id },
  });
  if (!source) return;

  await db.$transaction([
    db.sharedProviderCredential.upsert({
      where: { userId_provider: { userId: user.id, provider: source.provider } },
      create: {
        userId: user.id,
        provider: source.provider,
        encryptedKey: source.encryptedKey,
        keyPreview: source.keyPreview,
      },
      update: { encryptedKey: source.encryptedKey, keyPreview: source.keyPreview },
    }),
    db.providerCredential.delete({ where: { id: source.id } }),
  ]);

  revalidatePath("/settings");
}

export async function removeSharedProviderCredential(credentialId: string): Promise<void> {
  const { user } = await requireCompany();

  // Ownership check: only remove a shared credential that actually
  // belongs to the caller — never scoped by company, since this table
  // has no company relation at all.
  await db.sharedProviderCredential.deleteMany({
    where: { id: credentialId, userId: user.id },
  });

  revalidatePath("/settings");
}
