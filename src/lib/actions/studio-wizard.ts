"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { getCompanyContext, getCompanyTopicPool } from "@/lib/company-context";
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
    //
    // Working exactly as intended (confirmed 2026-08-25, real user
    // complaint investigation): clicking this again the same day
    // correctly shows the same idea, by design — one suggestion per
    // day, not a shuffle button. "Show me another idea" below is the
    // real, distinct escape hatch for on-demand variety instead.
    //
    // Real fix (2026-09-01): the pool now widens with this company's
    // own secondaryNiches when set, not just the generic industry pack
    // — see getCompanyTopicPool's own doc comment for the confirmed gap
    // this closes (two same-industry companies always seeing identical
    // suggestions regardless of real per-company data).
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const dailyPool = getCompanyTopicPool(context);
    topic = dailyPool[dayIndex % dailyPool.length];
  } else if (formData.get("showAnotherIdea") === "true") {
    // Real fix (2026-08-25): genuinely random, not day-locked — draws
    // from autoTopics ∪ topicSuggestions' real topic phrases (already
    // vetted the same "grammatically safe noun phrase" way autoTopics
    // is, see topicSuggestions' own doc comment in industry-packs.ts),
    // excluding today's autoTopics pick so a click here is guaranteed
    // to differ from what "Auto-Generate Daily Idea" would show right
    // now, not just usually different by chance.
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const dailyPool = getCompanyTopicPool(context);
    const todaysAutoTopic = dailyPool[dayIndex % dailyPool.length];
    const pool = [...dailyPool, ...context.pack.topicSuggestions.map((s) => s.topic)].filter(
      (t) => t !== todaysAutoTopic,
    );
    topic = pool[Math.floor(Math.random() * pool.length)] ?? todaysAutoTopic;
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

  // Real bug fixed here (2026-08-25): variantIndex 0/1/2 gives 3
  // distinct captions WITHIN one submission, but re-submitting the
  // identical topic (clicking Generate again) always requested the same
  // 0/1/2 again — byte-identical results on the free tier, since
  // TemplateTextProvider is fully deterministic given identical inputs.
  // `attempt` (how many times this exact topic has already been
  // submitted this session) shifts the whole 3-slot window into fresh
  // territory each time. BYOK providers ignore variantIndex entirely
  // (real LLM sampling already varies call to call).
  const attemptParsed = z.coerce.number().int().min(0).max(1000).safeParse(formData.get("attempt"));
  const attempt = attemptParsed.success ? attemptParsed.data : 0;

  const captions: string[] = [];
  try {
    // 3 independent calls to the same real generateCaption used
    // everywhere else (Video Studio's caption step, Repurpose) — not a
    // new variant-generation feature.
    for (let i = 0; i < 3; i += 1) {
      const result = await textProvider.generateCaption({ context, topic, variantIndex: attempt * 3 + i });
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
