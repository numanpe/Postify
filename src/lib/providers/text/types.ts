import type { CompanyContext } from "@/lib/company-context";
import type { SocialPlatform } from "@prisma/client";

export interface GenerateCaptionInput {
  context: CompanyContext;
  topic: string;
}

export interface GenerateCaptionOutput {
  text: string;
  providerName: string;
  model?: string;
  estimatedCostUsd?: number;
}

export interface GenerateScriptInput {
  context: CompanyContext;
  topic: string;
}

// system #4's structure: hook -> context -> value -> message -> CTA.
export interface VideoScriptSections {
  hook: string;
  context: string;
  value: string;
  message: string;
  cta: string;
}

export interface GenerateScriptOutput {
  script: VideoScriptSections;
  providerName: string;
  model?: string;
  estimatedCostUsd?: number;
}

// The AI Creative Director (src/lib/campaign/creative-director.ts) —
// takes a campaign objective and produces a full, per-day multi-asset
// execution brief: which items are posters vs. videos, their poster
// text or video topic, captions, hashtags, and a suggested posting
// time, all grounded in the same real Company/BrandKit/industry-pack
// data every other generator here uses. Supersedes the older
// angles-only GenerateCampaignPlan (nothing else called it).
export interface GenerateCampaignBriefInput {
  context: CompanyContext;
  objective: string;
  itemCount: number;
  // One ISO date (YYYY-MM-DD) per item, same order — the campaign's
  // already-computed schedule (src/lib/actions/campaign.ts), used to
  // produce a real suggested posting timestamp per asset.
  scheduledDates: string[];
  // Only the platforms the company has an actual SocialAccount
  // connection for — never a platform this app can't really publish to
  // (e.g. TikTok, which has no integration in this app at all).
  connectedPlatforms: SocialPlatform[];
}

export interface CampaignBriefItem {
  // Only the two asset types with a real backing renderer — see
  // CampaignAssetType in schema.prisma.
  assetType: "POSTER" | "VIDEO";
  // Short day-level description, always present — shown in the
  // calendar UI regardless of asset type, and used as the poster
  // headline / video topic fallback if the type-specific fields below
  // are absent.
  angle: string;
  // Poster-pipeline inputs (assetType === "POSTER").
  headline?: string;
  subhead?: string;
  cta?: string;
  // Video-pipeline input (assetType === "VIDEO") — a topic, not a
  // pre-written script: the existing 7-step video pipeline
  // (src/lib/video/generate.ts) generates its own script from a topic,
  // the same way the standalone Video Studio does. Accepting a fully
  // pre-scripted/storyboarded brief would need deeper changes to that
  // pipeline and isn't implemented.
  videoTopic?: string;
  captionText: string;
  hashtags: string[];
  suggestedPostAt: string; // ISO datetime
  targetPlatforms: SocialPlatform[];
}

export interface GenerateCampaignBriefOutput {
  // Free text, not a fixed set — e.g. "Product Launch", "Seasonal
  // Sale", "Educational", "Flash Promo", "Customer Story" are examples,
  // not an exhaustive enum; SME industries need types beyond these.
  campaignType: string;
  // Exactly itemCount entries, one per scheduled day — a coherent arc,
  // not itemCount unrelated topics.
  items: CampaignBriefItem[];
  providerName: string;
  model?: string;
  estimatedCostUsd?: number;
}

// Stage 2 (Visual Prompt Engineer) of the poster AI-background pipeline
// — see src/lib/poster/background-context.ts for Stage 1, which
// produces the fields below without an LLM call. This interface
// intentionally doesn't import poster/background-context.ts's types
// (keeps providers/ independent of poster/); the shapes match
// structurally.
export interface ExpandBackgroundPromptInput {
  rawUserPrompt: string;
  industry: string;
  visualTone: string;
  accentColorsForBackground: string[];
  forbiddenStyles: string[];
  layoutDirection: "LTR" | "RTL";
  aspectRatio: "1:1" | "9:16" | "16:9";
  // Only "overlay" poster templates (Minimal, Bold Headline) composite
  // text over the photo — "panel" templates (Promotional Banner, Split
  // Product) put text on a separate solid block, so the background can
  // be fully clean with no reserved space. See
  // POSTER_TEMPLATES[template].contrastSpec.kind in templates.tsx.
  reservesTextSpace: boolean;
}

export interface ExpandBackgroundPromptOutput {
  expandedVisualPrompt: string;
  negativePrompt: string;
  designParameters: {
    aspectRatio: string;
    colorPalette: string[];
    compositionStyle: "Minimalist" | "Bold Geometric" | "Organic";
  };
  providerName: string;
}

export interface TextProvider {
  readonly name: string;
  generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionOutput>;
  generateScript(input: GenerateScriptInput): Promise<GenerateScriptOutput>;
  generateCampaignBrief(input: GenerateCampaignBriefInput): Promise<GenerateCampaignBriefOutput>;
  expandBackgroundPrompt(input: ExpandBackgroundPromptInput): Promise<ExpandBackgroundPromptOutput>;
}

// Thrown for anything the UI should surface directly to the user (bad
// key, rate limit, provider down) — per CLAUDE.md's "no fake
// functionality": a failed BYOK call must say so, never silently fall
// back to the free template pretending nothing went wrong.
export class ProviderError extends Error {
  constructor(
    public providerName: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
