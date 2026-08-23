"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { guardTopic, TopicGuardError } from "@/lib/actions/topic-guard";

export type WizardStep1State =
  | { status: "error"; error: string }
  | {
      status: "success";
      topic: string;
      captions: string[];
      hashtags: string[];
      // See content.ts's identical field — only set when the raw typed
      // topic was flagged and a BYOK provider inferred a real subject.
      wasClarified: boolean;
    }
  | undefined;

const TopicSchema = z.string().trim().min(3, "Describe what this post is about (a few words).").max(300);

export async function generateWizardStep1(
  _prevState: WizardStep1State,
  formData: FormData,
): Promise<WizardStep1State> {
  const { company } = await requireCompany();
  const context = await getCompanyContext(company.id);

  const textProvider = await getTextProviderForCompany(company.id);
  let topic: string;
  let wasClarified = false;
  if (formData.get("autoGenerate") === "true") {
    // Real, industry-relevant, deterministically rotating by day — not
    // a fabricated "AI analyzed your brand" claim (there's no signal
    // to base one on yet), and works with zero keys either way.
    //
    // Real bug fixed here: this used to draw straight from
    // shortHeadlines (poster-headline slogans, e.g. "We Handle The
    // Details") and feed that directly into caption generation as
    // {{topic}} — producing broken English like "We Handle The Details
    // means answers you can actually act on." shortHeadlines are
    // written to stand alone on a poster, not to sit grammatically
    // inside a caption template built for a noun phrase. autoTopics
    // (industry-packs.ts) exists specifically for this: real
    // industry-relevant phrases actually checked against every
    // {{topic}} template slot.
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    topic = context.pack.autoTopics[dayIndex % context.pack.autoTopics.length];
  } else {
    const parsed = TopicSchema.safeParse(formData.get("topic"));
    if (!parsed.success) {
      return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    try {
      const guard = await guardTopic(parsed.data, textProvider, context);
      topic = guard.topic;
      wasClarified = guard.wasClarified;
    } catch (error) {
      if (error instanceof TopicGuardError) {
        return { status: "error", error: error.message };
      }
      throw error;
    }
  }

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

  return { status: "success", topic, captions, hashtags: context.pack.hashtags, wasClarified };
}
