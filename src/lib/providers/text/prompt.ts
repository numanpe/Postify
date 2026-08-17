import type { SocialPlatform } from "@prisma/client";

import type { CompanyContext } from "@/lib/company-context";
import type { ExpandBackgroundPromptInput, ExpandBackgroundPromptOutput, CampaignBriefItem, GenerateCampaignBriefOutput } from "./types";
import { ProviderError } from "./types";

// Shared by every BYOK provider so a real LLM's output is grounded in
// the same company context the free template uses — BYOK unlocks
// quality, not a different (generic) product.
export function buildCaptionPrompt(
  context: CompanyContext,
  topic: string,
): { system: string; user: string } {
  const { name, industry, tone, secondaryNiches } = context;

  const nicheLine = secondaryNiches.length
    ? ` The company also focuses on: ${secondaryNiches.join(", ")}.`
    : "";

  const system = [
    `You are a marketing copywriter for a company in the ${industry} industry.`,
    `Brand tone: ${tone}.`,
    "Write one concise, natural social media caption — at most two short sentences.",
    "No hashtags unless they read naturally. No generic filler.",
    "Never invent specific facts (prices, dates, promises) that weren't given to you.",
  ].join(" ");

  const user = `Company: ${name}.${nicheLine}\n\nWrite a short social media caption about: ${topic}`;

  return { system, user };
}

// system #4's structure: hook -> context -> value -> message -> CTA.
// Asks for strict JSON so callers can parse structured sections rather
// than trying to split a single blob of prose.
export function buildScriptPrompt(
  context: CompanyContext,
  topic: string,
): { system: string; user: string } {
  const { name, industry, tone, secondaryNiches } = context;

  const nicheLine = secondaryNiches.length
    ? ` The company also focuses on: ${secondaryNiches.join(", ")}.`
    : "";

  const system = [
    `You are a video creative director for a company in the ${industry} industry.`,
    `Brand tone: ${tone}.`,
    "Write a short-form video voiceover script (15-30 seconds spoken) with exactly five sections:",
    "hook (grabs attention in the first line), context (sets up the situation), value (the benefit to the viewer),",
    "message (ties directly to the specific topic given), cta (a clear call to action).",
    "Each section is 1-2 short spoken sentences — natural spoken language, not written copy.",
    "No hashtags, no emoji, no stage directions. Never invent specific facts (prices, dates, promises) not given to you.",
    'Respond with ONLY a JSON object: {"hook": "...", "context": "...", "value": "...", "message": "...", "cta": "..."}',
  ].join(" ");

  const user = `Company: ${name}.${nicheLine}\n\nWrite a video script about: ${topic}`;

  return { system, user };
}

// Real, not exhaustive — a defensible floor for "no AI filler words",
// not a claim of perfect coverage. Shared between the prompt
// instruction below and post-hoc validation in the BYOK providers
// (findBannedFillerWords), since an instruction alone doesn't guarantee
// compliance.
const BANNED_FILLER_WORDS = [
  "unleash",
  "delve",
  "game-changer",
  "game changer",
  "elevate",
  "unlock",
  "revolutionize",
  "revolutionary",
  "seamless",
  "seamlessly",
  "leverage",
  "supercharge",
  "cutting-edge",
  "cutting edge",
  "unparalleled",
  "empower",
];

export function findBannedFillerWords(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_FILLER_WORDS.filter((word) => lower.includes(word));
}

// The AI Creative Director — takes a campaign objective and real
// company/brand context and produces a full, per-day multi-asset
// execution brief (poster or video, headline/topic, caption, hashtags,
// posting time). Mirrors buildBackgroundExpansionPrompt's relationship
// to background-context.ts: this is Stage 2 (creative expansion, real
// LLM), fed by real data the caller already fetched, not invented here.
export function buildCampaignBriefPrompt(input: {
  context: CompanyContext;
  objective: string;
  itemCount: number;
  scheduledDates: string[];
  connectedPlatforms: string[];
}): { system: string; user: string } {
  const { context, objective, itemCount, scheduledDates, connectedPlatforms } = input;
  const { name, industry, tone, secondaryNiches, locale } = context;

  const nicheLine = secondaryNiches.length ? ` The company also focuses on: ${secondaryNiches.join(", ")}.` : "";
  const languageInstruction =
    locale === "AR"
      ? "Write all headline/topic, caption, and hashtag text in natural, culturally idiomatic Arabic — not a literal word-for-word translation of an English draft. Set every item's captionText to read naturally to a native Arabic speaker."
      : "Write all text in English.";

  const system = [
    `You are the AI Creative Director for a company in the ${industry} industry.`,
    `Brand tone: ${tone}.`,
    `Plan exactly ${itemCount} distinct daily campaign assets for one campaign with a single objective, forming a`,
    "coherent arc across the days (e.g. announce, build interest, highlight a benefit, social proof, create urgency,",
    "recap) — not the same idea repeated, and not unrelated topics.",
    "Infer a short, free-text campaign_type label from the objective (e.g. \"Product Launch\", \"Seasonal Sale\",",
    "\"Educational\", \"Flash Promo\", \"Customer Story\", or another label if none of those fit — these are examples,",
    "not a fixed list).",
    `Item 1's assetType must be "VIDEO" if there is more than one item, otherwise "POSTER"; every other item's`,
    'assetType must be "POSTER" — this app\'s video pipeline is slower and heavier, so only the campaign-opening',
    "asset uses it.",
    'For a "POSTER" item: headline is a punchy 2-5 word hook (not a full sentence), subhead is a short supporting',
    'line, cta is a short action phrase. For a "VIDEO" item: videoTopic is a short topic description — NOT a',
    "full script; the video pipeline writes its own script from this topic.",
    "captionText is a natural, engaging post caption (emojis welcome where natural).",
    `hashtags is 3-5 relevant tags. targetPlatforms must be a subset of exactly this list, never anything else:`,
    `${JSON.stringify(connectedPlatforms)} — if that list is empty, return an empty array, don't invent a platform.`,
    `suggestedPostAt is an ISO datetime on that item's scheduled date (use the date given for that item, any`,
    "reasonable time of day).",
    languageInstruction,
    "STRICTLY PROHIBITED in any language, in any field: corporate buzzwords/filler like \"unleash\", \"delve\",",
    "\"game-changer\", \"elevate\", \"unlock\", \"revolutionize\", \"seamless\", \"leverage\", or similar robotic marketing",
    "jargon. Write like a real person, not an ad-copy generator.",
    "Never invent specific facts (prices, dates, promises) that weren't given to you.",
    'Respond with ONLY a JSON object: {"campaignType": "...", "items": [{"assetType": "POSTER"|"VIDEO", "angle":',
    '"...", "headline": "...", "subhead": "...", "cta": "...", "videoTopic": "...", "captionText": "...",',
    '"hashtags": ["...","..."], "suggestedPostAt": "...", "targetPlatforms": ["..."]}, ...]} with exactly',
    `${itemCount} items in order. Omit headline/subhead/cta for VIDEO items and videoTopic for POSTER items.`,
  ].join(" ");

  const scheduleLines = scheduledDates.map((date, i) => `Item ${i + 1} scheduled date: ${date}`).join("\n");
  const user = `Company: ${name}.${nicheLine}\n\nCampaign objective: ${objective}\n\n${scheduleLines}`;

  return { system, user };
}

// Shared by both BYOK providers (openai-provider.ts, anthropic-provider.ts)
// so this nested-object validation exists exactly once. Distinct from the
// script/campaign validation pattern elsewhere in this file (which stays
// per-provider, simpler shapes) because designParameters is a nested
// object worth checking as a unit.
export function parseExpandedPromptResponse(parsed: unknown, providerName: string): ExpandBackgroundPromptOutput {
  if (typeof parsed !== "object" || parsed === null) {
    throw new ProviderError(providerName, "Unexpected background-prompt response format.");
  }
  const record = parsed as Record<string, unknown>;
  const designParameters = record.designParameters as Record<string, unknown> | undefined;

  if (typeof record.expandedVisualPrompt !== "string" || !record.expandedVisualPrompt) {
    throw new ProviderError(providerName, "Background-prompt response is missing expandedVisualPrompt.");
  }
  if (typeof record.negativePrompt !== "string") {
    throw new ProviderError(providerName, "Background-prompt response is missing negativePrompt.");
  }
  if (
    !designParameters ||
    typeof designParameters.aspectRatio !== "string" ||
    !Array.isArray(designParameters.colorPalette) ||
    !["Minimalist", "Bold Geometric", "Organic"].includes(designParameters.compositionStyle as string)
  ) {
    throw new ProviderError(providerName, "Background-prompt response has an invalid designParameters shape.");
  }

  return {
    expandedVisualPrompt: record.expandedVisualPrompt,
    negativePrompt: record.negativePrompt,
    designParameters: {
      aspectRatio: designParameters.aspectRatio as string,
      colorPalette: designParameters.colorPalette as string[],
      compositionStyle: designParameters.compositionStyle as "Minimalist" | "Bold Geometric" | "Organic",
    },
    providerName,
  };
}

// Stage 2 of the poster AI-background pipeline (Visual Prompt
// Engineer). Takes Stage 1's structured, real-brand-data context (never
// invents brand facts itself) and expands it into concrete generation
// detail. Mirrors the reading direction into an actual compositional
// consequence rather than passing the RTL/LTR flag through unused —
// see reservesTextSpace's doc comment in types.ts for why that only
// applies to overlay-style poster templates.
export function buildBackgroundExpansionPrompt(
  input: ExpandBackgroundPromptInput,
): { system: string; user: string } {
  const { rawUserPrompt, visualTone, accentColorsForBackground, forbiddenStyles, layoutDirection, aspectRatio, reservesTextSpace } = input;

  const system = [
    "You are a Visual Prompt Engineer for an AI background-image generation pipeline feeding a poster template.",
    "Expand the given brand context and topic into a vivid, concrete background-image prompt: composition, subject,",
    "lighting, mood, color palette, and rendering style — specific lighting conditions, textures, and depth of field,",
    'never empty buzzwords like "photorealistic" or "hyper-detailed".',
    "Treat the given forbidden styles as hard negative constraints, not suggestions.",
    reservesTextSpace
      ? "Text will be overlaid on this background later, so the composition must stay uncluttered enough for legible text — actually mirror the given reading direction in how you describe where visual detail/weight sits, don't just acknowledge it."
      : "This background will NOT have text overlaid on it directly (text sits on a separate solid panel elsewhere on the poster) — compose it as a clean standalone photo, no reserved empty space needed.",
    "The image itself must contain no embedded text, logos, or watermarks — those are composited separately.",
    "If the topic is written in a non-English script (e.g. Arabic), describe the visual subject in English based on",
    "its meaning — do not embed the non-English text itself into expandedVisualPrompt, since the image model doesn't",
    "reliably interpret non-Latin script as a subject cue; the poster's own text overlay (separate from this image) is",
    "unaffected either way.",
    "Never invent brand facts (products, claims, specifics) beyond what's given to you.",
    'Respond with ONLY a JSON object: {"expandedVisualPrompt": "...", "negativePrompt": "...", ' +
      '"designParameters": {"aspectRatio": "...", "colorPalette": ["#hex", "#hex"], ' +
      '"compositionStyle": "Minimalist" | "Bold Geometric" | "Organic"}}',
  ].join(" ");

  const user = [
    `Topic: ${rawUserPrompt}`,
    `Visual tone: ${visualTone}`,
    `Brand accent colors: ${accentColorsForBackground.join(", ") || "none set"}`,
    `Forbidden styles: ${forbiddenStyles.join(", ")}`,
    `Layout direction: ${layoutDirection}`,
    `Aspect ratio: ${aspectRatio}`,
    `Reserve space for overlaid text: ${reservesTextSpace ? "yes" : "no"}`,
  ].join("\n");

  return { system, user };
}

// Shared by both BYOK providers. Validates structure AND re-checks the
// banned-filler-word instruction post-hoc (findBannedFillerWords) —
// an instruction in the prompt doesn't guarantee compliance, so a
// response that slips one through fails loudly here rather than
// shipping filler copy silently.
export function parseCampaignBriefResponse(
  parsed: unknown,
  providerName: string,
  itemCount: number,
  connectedPlatforms: SocialPlatform[],
): GenerateCampaignBriefOutput {
  if (typeof parsed !== "object" || parsed === null) {
    throw new ProviderError(providerName, "Unexpected campaign-brief response format.");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.campaignType !== "string" || !record.campaignType) {
    throw new ProviderError(providerName, "Campaign-brief response is missing campaignType.");
  }
  if (!Array.isArray(record.items) || record.items.length !== itemCount) {
    throw new ProviderError(providerName, `Campaign-brief response didn't return exactly ${itemCount} items.`);
  }

  const items: CampaignBriefItem[] = record.items.map((raw, index) => {
    const item = raw as Record<string, unknown>;
    if (item.assetType !== "POSTER" && item.assetType !== "VIDEO") {
      throw new ProviderError(providerName, `Item ${index + 1} has an invalid assetType.`);
    }
    if (typeof item.angle !== "string" || !item.angle) {
      throw new ProviderError(providerName, `Item ${index + 1} is missing angle.`);
    }
    if (typeof item.captionText !== "string" || !item.captionText) {
      throw new ProviderError(providerName, `Item ${index + 1} is missing captionText.`);
    }
    if (!Array.isArray(item.hashtags) || !item.hashtags.every((h) => typeof h === "string")) {
      throw new ProviderError(providerName, `Item ${index + 1} has an invalid hashtags list.`);
    }
    if (typeof item.suggestedPostAt !== "string" || Number.isNaN(Date.parse(item.suggestedPostAt))) {
      throw new ProviderError(providerName, `Item ${index + 1} has an invalid suggestedPostAt.`);
    }
    const targetPlatforms = Array.isArray(item.targetPlatforms)
      ? item.targetPlatforms.filter((p): p is SocialPlatform => connectedPlatforms.includes(p as SocialPlatform))
      : [];

    const fillerCheck = [item.angle, item.headline, item.subhead, item.cta, item.videoTopic, item.captionText]
      .filter((v): v is string => typeof v === "string")
      .flatMap((text) => findBannedFillerWords(text));
    if (fillerCheck.length > 0) {
      throw new ProviderError(
        providerName,
        `Item ${index + 1} used a prohibited marketing buzzword (${fillerCheck.join(", ")}) despite instructions.`,
      );
    }

    return {
      assetType: item.assetType,
      angle: item.angle,
      headline: typeof item.headline === "string" ? item.headline : undefined,
      subhead: typeof item.subhead === "string" ? item.subhead : undefined,
      cta: typeof item.cta === "string" ? item.cta : undefined,
      videoTopic: typeof item.videoTopic === "string" ? item.videoTopic : undefined,
      captionText: item.captionText,
      hashtags: item.hashtags as string[],
      suggestedPostAt: item.suggestedPostAt,
      targetPlatforms,
    };
  });

  return { campaignType: record.campaignType, items, providerName };
}
