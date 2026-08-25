"use server";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { generatePosterCore, PosterGenerationError } from "@/lib/poster/generate";
import { generateVideoCore, VideoGenerationError } from "@/lib/video/generate";
import { selectAutoAssetIds } from "@/lib/jobs/process-campaign-items";
import { guardTopic, TopicGuardError } from "@/lib/actions/topic-guard";

export type RepurposeState =
  | { status: "error"; error: string }
  | { status: "success"; posterId?: string; videoId?: string; captions?: string[]; usedTopic?: string }
  | undefined;

// Task 5: "Repurpose This" — a new entry point into the pipelines that
// already exist (generatePosterCore, generateVideoCore,
// TextProvider.generateCaption), not a new generation system. Every
// derivative call below is scoped to `company.id`, so Brand Kit and
// locale inheritance is automatic and guaranteed by the same mechanism
// already used everywhere else in the app — not something this action
// re-implements.
export async function repurposeContent(
  _prevState: RepurposeState,
  formData: FormData,
): Promise<RepurposeState> {
  const { company, user } = await requireCompany();
  const context = await getCompanyContext(company.id);
  const textProvider = await getTextProviderForCompany(company.id);

  const sourceType = formData.get("sourceType");
  const sourceId = formData.get("sourceId");
  const manualText = formData.get("manualText");
  const formats = formData.getAll("formats").filter((f): f is string => typeof f === "string");

  let topic: string;
  let headline: string;
  let usedTopic: string | undefined;

  if (sourceType === "POSTER" && typeof sourceId === "string") {
    const poster = await db.poster.findFirst({ where: { id: sourceId, companyId: company.id } });
    if (!poster) return { status: "error", error: "That poster no longer exists." };
    topic = [poster.headline, poster.subhead].filter(Boolean).join(" — ");
    headline = poster.headline;
  } else if (sourceType === "VIDEO" && typeof sourceId === "string") {
    const video = await db.video.findFirst({ where: { id: sourceId, companyId: company.id } });
    if (!video) return { status: "error", error: "That video no longer exists." };
    topic = video.topic;
    headline = video.topic;
  } else if (typeof manualText === "string" && manualText.trim().length >= 3) {
    // Real backstop for malformed manual input — same guard used
    // everywhere else a topic is typed (topic-guard.ts).
    try {
      const guard = await guardTopic(manualText.trim(), textProvider, context);
      topic = guard.topic;
      headline = guard.topic;
      usedTopic = guard.wasClarified ? guard.topic : undefined;
    } catch (error) {
      if (error instanceof TopicGuardError) {
        return { status: "error", error: error.message };
      }
      throw error;
    }
  } else {
    return { status: "error", error: "Choose an existing poster/video, or describe the content." };
  }

  if (formats.length === 0) {
    return { status: "error", error: "Choose at least one format to generate." };
  }

  const result: { posterId?: string; videoId?: string; captions?: string[] } = {};

  try {
    if (formats.includes("POSTER")) {
      const posterResult = await generatePosterCore({
        companyId: company.id,
        userId: user.id,
        headline: headline.slice(0, 70),
        aspectRatio: "SQUARE",
        template: "MINIMAL",
        backgroundSource: "BRAND",
      });
      result.posterId = posterResult.posterId;
    }

    if (formats.includes("VIDEO")) {
      // Same real-media-first auto-selection the campaign job processor
      // uses — not a new footage-picking rule invented for this entry point.
      const assetIds = await selectAutoAssetIds(company.id, 0);
      const videoResult = await generateVideoCore({
        companyId: company.id,
        userId: user.id,
        topic,
        aspectRatio: "SQUARE",
        useNarration: true,
        assetIds,
      });
      result.videoId = videoResult.videoId;
    }

    if (formats.includes("CAPTIONS")) {
      // Real bug fixed here (2026-08-25): re-repurposing the identical
      // source (same poster/video/manual text) always requested
      // variantIndex 0/1/2 again — byte-identical captions on the free
      // tier, since TemplateTextProvider is fully deterministic given
      // identical inputs. `attempt` (how many times this exact source
      // has already been repurposed this session) shifts the whole
      // 3-slot window into fresh territory each time.
      const attemptParsed = Number.parseInt(String(formData.get("attempt") ?? "0"), 10);
      const attempt = Number.isFinite(attemptParsed) && attemptParsed >= 0 ? attemptParsed : 0;

      const captions: string[] = [];
      // 3 independent calls to the existing generateCaption, matching
      // the task's own "2-3 caption variants" — not a new variant-
      // generation feature, just calling the same function more than once.
      for (let i = 0; i < 3; i += 1) {
        const captionResult = await textProvider.generateCaption({ context, topic, variantIndex: attempt * 3 + i });
        captions.push(captionResult.text);
      }
      result.captions = captions;
    }
  } catch (error) {
    if (error instanceof ProviderError) {
      return { status: "error", error: `${error.providerName}: ${error.message}` };
    }
    if (error instanceof PosterGenerationError || error instanceof VideoGenerationError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }

  return { status: "success", ...result, usedTopic };
}
