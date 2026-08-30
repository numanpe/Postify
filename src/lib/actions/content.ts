"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { guardTopic, TopicGuardError } from "@/lib/actions/topic-guard";
import type { FallbackInfo } from "@/lib/providers/fallback-log";

export type GenerateCaptionState =
  | { status: "error"; error: string }
  | {
      status: "success";
      text: string;
      providerName: string;
      model?: string;
      estimatedCostUsd?: number;
      // Only set when the raw typed topic was flagged as malformed and
      // a BYOK provider inferred a real subject instead — see
      // topic-guard.ts. Lets the UI show what was actually used rather
      // than silently swapping the user's input.
      usedTopic?: string;
      // Only set when the resolver's runtime-failure fallback chain
      // (text/resolver.ts) actually kicked in — real disclosure per
      // this project's no-hidden-failures principle, never shown for a
      // company's own first-choice provider succeeding normally.
      fallbackFrom?: FallbackInfo[];
    }
  | undefined;

const TopicSchema = z
  .string()
  .trim()
  .min(3, "Describe what this post is about (a few words).")
  .max(300);

export async function generateCaption(
  _prevState: GenerateCaptionState,
  formData: FormData,
): Promise<GenerateCaptionState> {
  const { company } = await requireCompany();

  const parsed = TopicSchema.safeParse(formData.get("topic"));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const context = await getCompanyContext(company.id);
  const provider = await getTextProviderForCompany(company.id);

  // Real bug fixed here (2026-08-25): this never passed variantIndex,
  // so on the free tier — fully deterministic given identical inputs,
  // see template-provider.ts — clicking Generate again for the exact
  // same topic silently returned byte-identical text every time. The
  // form now sends how many times this topic has already been
  // submitted in this session (attempt, a plain hidden counter, not
  // persisted anywhere) so a repeat click actually produces a
  // different pick. BYOK providers ignore variantIndex entirely (real
  // LLM sampling already varies call to call), so this is a no-op for
  // them, not a behavior change.
  const attemptParsed = z.coerce.number().int().min(0).max(1000).safeParse(formData.get("attempt"));
  const attempt = attemptParsed.success ? attemptParsed.data : 0;

  try {
    const guard = await guardTopic(parsed.data, provider, context);
    const result = await provider.generateCaption({ context, topic: guard.topic, variantIndex: attempt });
    return {
      status: "success",
      text: result.text,
      providerName: result.providerName,
      model: result.model,
      estimatedCostUsd: result.estimatedCostUsd,
      usedTopic: guard.wasClarified ? guard.topic : undefined,
      fallbackFrom: result.fallbackFrom,
    };
  } catch (error) {
    if (error instanceof TopicGuardError) {
      return { status: "error", error: error.message };
    }
    if (error instanceof ProviderError) {
      return { status: "error", error: `${error.providerName}: ${error.message}` };
    }
    throw error;
  }
}
