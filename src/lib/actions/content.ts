"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";

export type GenerateCaptionState =
  | { status: "error"; error: string }
  | {
      status: "success";
      text: string;
      providerName: string;
      model?: string;
      estimatedCostUsd?: number;
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
    const result = await provider.generateCaption({ context, topic: parsed.data });
    return {
      status: "success",
      text: result.text,
      providerName: result.providerName,
      model: result.model,
      estimatedCostUsd: result.estimatedCostUsd,
    };
  } catch (error) {
    if (error instanceof ProviderError) {
      return { status: "error", error: `${error.providerName}: ${error.message}` };
    }
    throw error;
  }
}
