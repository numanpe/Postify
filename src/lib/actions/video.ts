"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { generateVideoCore, VideoGenerationError } from "@/lib/video/generate";

export type GenerateVideoState =
  | { status: "error"; error: string }
  | { status: "success"; videoId: string; warnings: string[] }
  | undefined;

const VideoSchema = z.object({
  topic: z.string().trim().min(3, "Describe what this video is about.").max(300),
  aspectRatio: z.enum(["SQUARE", "STORY", "LANDSCAPE"]),
  useNarration: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  assetIds: z.array(z.string()).default([]),
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
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await generateVideoCore({
      companyId: company.id,
      userId: user.id,
      ...parsed.data,
    });
    // Video list refresh happens client-side (video-form.tsx's
    // router.refresh() on success) instead of here — see poster.ts's
    // identical change and the README's ISR Writes note.
    return { status: "success", videoId: result.videoId, warnings: result.warnings };
  } catch (error) {
    if (error instanceof VideoGenerationError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
}
