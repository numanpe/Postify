"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { generateVideoCore, VideoGenerationError } from "@/lib/video/generate";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { guardTopic, TopicGuardError } from "@/lib/actions/topic-guard";
import type { FallbackInfo } from "@/lib/providers/fallback-log";

export type GenerateVideoState =
  | { status: "error"; error: string }
  | {
      status: "success";
      videoId: string;
      warnings: string[];
      usedTopic?: string;
      fallbackFrom?: FallbackInfo[];
    }
  | undefined;

const VideoSchema = z.object({
  topic: z.string().trim().min(3, "Describe what this video is about.").max(300),
  aspectRatio: z.enum(["SQUARE", "STORY", "LANDSCAPE"]),
  useNarration: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  assetIds: z.array(z.string()).default([]),
  // nullish, not just an unset-default — FormData.get() returns null
  // (not undefined) for a field that isn't submitted at all, which
  // z's plain .default() doesn't catch (see brand-kit.ts's identical
  // fix for the same FormData/zod gotcha).
  template: z
    .enum(["STANDARD", "LOWER_THIRD_PROMO", "WAVEFORM_CAPTIONS"])
    .nullish()
    .transform((value) => value ?? "STANDARD"),
});

export async function generateVideo(
  _prevState: GenerateVideoState,
  formData: FormData,
): Promise<GenerateVideoState> {
  const { user, company } = await requireCompany();

  const parsed = VideoSchema.safeParse({
    topic: formData.get("topic"),
    aspectRatio: formData.get("aspectRatio"),
    useNarration: formData.get("useNarration"),
    assetIds: formData.getAll("assetIds"),
    template: formData.get("template"),
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    // Real backstop for malformed video topics — same guard used
    // everywhere else a topic is typed (topic-guard.ts). The video
    // pipeline generates its own script directly from this topic, so a
    // flagged raw topic would otherwise reach that script generation
    // completely unfiltered.
    const context = await getCompanyContext(company.id);
    const textProvider = await getTextProviderForCompany(company.id);
    const guard = await guardTopic(parsed.data.topic, textProvider, context);

    const result = await generateVideoCore({
      companyId: company.id,
      userId: user.id,
      ...parsed.data,
      topic: guard.topic,
    });
    // Video list refresh happens client-side (video-form.tsx's
    // router.refresh() on success) instead of here — see poster.ts's
    // identical change and the README's ISR Writes note.
    return {
      status: "success",
      videoId: result.videoId,
      warnings: result.warnings,
      usedTopic: guard.wasClarified ? guard.topic : undefined,
      fallbackFrom: result.fallbackFrom,
    };
  } catch (error) {
    if (error instanceof TopicGuardError) {
      return { status: "error", error: error.message };
    }
    if (error instanceof VideoGenerationError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
}
