"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";

const VoiceEngineSchema = z.enum(["FREE", "BYOK"]);

// A dedicated action rather than folding this into
// provider-credentials.ts — this toggles which engine narration uses,
// it doesn't store a credential. See resolver.ts for why this is an
// explicit per-company choice rather than "BYOK wins if a key exists".
export async function updateVoiceEngine(formData: FormData): Promise<void> {
  const { company } = await requireCompany();

  const parsed = VoiceEngineSchema.safeParse(formData.get("voiceEngine"));
  if (!parsed.success) return;

  await db.company.update({
    where: { id: company.id },
    data: { voiceEngine: parsed.data },
  });

  revalidatePath("/settings");
}
