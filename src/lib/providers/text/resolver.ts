import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { TextProvider } from "./types";
import { TemplateTextProvider } from "./template-provider";
import { OpenAITextProvider } from "./openai-provider";
import { AnthropicTextProvider } from "./anthropic-provider";

// The two-click rule: callers never choose a provider, they just ask
// for "the" provider for a company. BYOK wins when configured; the free
// template is the always-available fallback — never a silent fallback
// from a BYOK failure, only from BYOK being unconfigured in the first
// place.
export async function getTextProviderForCompany(companyId: string): Promise<TextProvider> {
  const credential = await db.providerCredential.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });

  if (!credential) {
    return new TemplateTextProvider();
  }

  const apiKey = decryptSecret(credential.encryptedKey);
  return credential.provider === "OPENAI"
    ? new OpenAITextProvider(apiKey)
    : new AnthropicTextProvider(apiKey);
}
