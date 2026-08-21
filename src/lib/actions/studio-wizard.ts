"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";

export type WizardStep1State =
  | { status: "error"; error: string }
  | { status: "success"; topic: string; captions: string[]; hashtags: string[] }
  | undefined;

const TopicSchema = z.string().trim().min(3, "Describe what this post is about (a few words).").max(300);

export async function generateWizardStep1(
  _prevState: WizardStep1State,
  formData: FormData,
): Promise<WizardStep1State> {
  const { company } = await requireCompany();
  const context = await getCompanyContext(company.id);

  let topic: string;
  if (formData.get("autoGenerate") === "true") {
    // Real, industry-relevant, deterministically rotating by day — not
    // a fabricated "AI analyzed your brand" claim (there's no signal
    // to base one on yet), and works with zero keys either way. Reuses
    // the same real, hand-written shortHeadlines every poster template
    // already draws from, not a new content source invented for this.
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    topic = context.pack.shortHeadlines[dayIndex % context.pack.shortHeadlines.length];
  } else {
    const parsed = TopicSchema.safeParse(formData.get("topic"));
    if (!parsed.success) {
      return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    topic = parsed.data;
  }

  const textProvider = await getTextProviderForCompany(company.id);
  const captions: string[] = [];
  try {
    // 3 independent calls to the same real generateCaption used
    // everywhere else (Video Studio's caption step, Repurpose) — not a
    // new variant-generation feature.
    for (let i = 0; i < 3; i += 1) {
      const result = await textProvider.generateCaption({ context, topic, variantIndex: i });
      captions.push(result.text);
    }
  } catch (error) {
    if (error instanceof ProviderError) {
      return { status: "error", error: `${error.providerName}: ${error.message}` };
    }
    throw error;
  }

  return { status: "success", topic, captions, hashtags: context.pack.hashtags };
}
