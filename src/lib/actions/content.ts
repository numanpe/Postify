"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { guardTopic, TopicGuardError } from "@/lib/actions/topic-guard";

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

  try {
    const guard = await guardTopic(parsed.data, provider, context);
    const result = await provider.generateCaption({ context, topic: guard.topic });
    return {
      status: "success",
      text: result.text,
      providerName: result.providerName,
      model: result.model,
      estimatedCostUsd: result.estimatedCostUsd,
      usedTopic: guard.wasClarified ? guard.topic : undefined,
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
