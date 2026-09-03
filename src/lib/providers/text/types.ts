import type { CompanyContext } from "@/lib/company-context";
import type { SocialPlatform, PosterTemplate, BackgroundSource } from "@prisma/client";
import type { FallbackInfo } from "../fallback-log";

// Part 2 of the 5-feature request: AI-drafted replies to real inbox
// comments/DMs (src/lib/inbox.ts). A short, single reply to ONE
// specific incoming message — not a new post, so it doesn't reuse
// GenerateCaptionInput's topic-driven shape.
export interface GenerateReplyInput {
  context: CompanyContext;
  incomingMessage: string;
  kind: "comment" | "dm";
  // Only used to decide whether addressing them by name reads
  // naturally — never fabricated when absent.
  authorName?: string;
}

export interface GenerateReplyOutput {
  text: string;
  providerName: string;
  model?: string;
  estimatedCostUsd?: number;
  fallbackFrom?: FallbackInfo[];
}

export interface GenerateCaptionInput {
  context: CompanyContext;
  topic: string;
  // Only meaningful to TemplateProvider's deterministic hash-based
  // picker (see template-provider.ts) — without this, calling
  // generateCaption more than once for the identical topic on the free
  // tier returns byte-identical text every time (no randomness in the
  // picker), which would make a "generate N variants" caller (e.g.
  // repurpose.ts) silently produce N copies of the same caption. BYOK
  // providers ignore this — real LLM sampling already varies call to
  // call.
  variantIndex?: number;
}

export interface GenerateCaptionOutput {
  text: string;
  providerName: string;
  model?: string;
  estimatedCostUsd?: number;
  fallbackFrom?: FallbackInfo[];
}

// Real backstop for malformed topic input (see topic-validation.ts /
// topic-guard.ts) — only ever called when validateTopic() has already
// flagged the raw input as a likely meta-instruction, bare URL, or
// implausibly long text, never on ordinary topics. BYOK-only by
// design: extracting a real subject from malformed text needs actual
// language understanding the free template tier doesn't have —
// TemplateTextProvider's implementation always returns null (see its
// own doc comment), which correctly routes the free tier to block-
// and-ask-the-user instead of guessing.
export interface ClarifyTopicInput {
  rawInput: string;
  companyName: string;
  industry: string;
}

export interface ClarifyTopicOutput {
  // null means "couldn't confidently extract a real topic" — the
  // caller must fall back to the same block-and-ask behavior as the
  // free tier, never proceed with the raw flagged text.
  clarifiedTopic: string | null;
  providerName: string;
}

export interface GenerateScriptInput {
  context: CompanyContext;
  topic: string;
  // Same real gap as GenerateCaptionInput.variantIndex (see its own
  // doc comment) — TemplateProvider.generateScript's picker was
  // 100% deterministic on companyId+tone+topic alone, confirmed via a
  // real test: 5 calls for the identical topic returned 5 byte-
  // identical scripts. Without this, a "Regenerate" click for the same
  // topic silently returns the same script every time.
  variantIndex?: number;
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
  fallbackFrom?: FallbackInfo[];
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
  // Optional explicit per-item mix, same length/order as itemCount —
  // when given, this replaces the default "item 1 is VIDEO if itemCount
  // > 1, every other item POSTER" rule (needed by the recurring daily
  // content plan's own "N videos + M posts" config, see
  // process-recurring-plans.ts). Omitted: unchanged existing behavior.
  itemAssetTypes?: ("POSTER" | "VIDEO")[];
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
  fallbackFrom?: FallbackInfo[];
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
  fallbackFrom?: FallbackInfo[];
}

// Real business-context derivation from a website extraction (see
// src/lib/brand-context.ts) — a short description, likely products/
// services, and a tone-of-voice descriptor, grounded in the site's
// actual text rather than invented. BYOK providers use a real LLM call;
// the free template tier (template-provider.ts) uses a simple, honest
// heuristic instead of skipping this capability entirely — never
// invents products it can't find, unlike a real LLM which is at least
// asked to.
export interface SummarizeBusinessContextInput {
  companyName: string;
  metaDescription: string | null;
  ogDescription: string | null;
  visibleText: string;
  // Real nav/header menu link text (brand-extract.ts) — the free
  // tier's real products heuristic leans on this as its primary
  // signal; BYOK providers may use it as an extra hint alongside their
  // own full-text understanding.
  navLinkTexts: string[];
}

export interface SummarizeBusinessContextOutput {
  description: string;
  products: string[];
  tone: string;
  providerName: string;
  fallbackFrom?: FallbackInfo[];
}

// INFOGRAPHIC_SHOWCASE poster template's icon-benefit rows + trust-badge
// row (2026-09-03) — real, topic-specific short phrases, not hardcoded
// generic claims. BYOK providers make a genuine LLM call grounded in the
// real headline; the free template tier (template-provider.ts) can't
// genuinely understand the headline's specific semantics without an
// LLM, so it honestly falls back to real per-industry content already
// in INDUSTRY_PACKS (hooks/valueProps) rather than faking topic-
// specificity it doesn't have — same tradeoff expandBackgroundPrompt's
// own free-tier implementation already makes.
export interface GeneratePosterHighlightsInput {
  context: CompanyContext;
  topic: string;
}

export interface PosterBenefit {
  headline: string;
  subtext: string;
}

export interface GeneratePosterHighlightsOutput {
  benefits: PosterBenefit[];
  trustBadges: string[];
  providerName: string;
  model?: string;
  estimatedCostUsd?: number;
  fallbackFrom?: FallbackInfo[];
}

// Natural-language poster editing (2026-09-03) — a real, addressable,
// structured representation of a generated poster's current state:
// exactly the fields the render pipeline (generate.ts/templates.tsx)
// actually consumes, nothing invented (e.g. no per-element "position" —
// the real renderer has no such concept; see this feature's own scope-
// boundary doc comment in poster-edit.ts). colors are the RESOLVED
// values already in effect (a poster's own override, or the company's
// real BrandKit default) — never null here even when the underlying
// override field is null, so the AI always sees real color values to
// reason about.
export interface PosterEditSpec {
  template: PosterTemplate;
  headline: string;
  subhead: string | null;
  cta: string | null;
  backgroundSource: BackgroundSource;
  // Only meaningful when backgroundSource is "PHOTO" — the real
  // MediaAsset id currently filling the image slot.
  backgroundAssetId: string | null;
  colors: { primary: string; secondary: string; accent: string };
}

export interface EditPosterInput {
  context: CompanyContext;
  currentSpec: PosterEditSpec;
  instruction: string;
  // Real Media Library photos this company actually has, id+fileName
  // only (cheap) — per the "prefer a real photo over generating a new
  // AI image" rule: if the instruction wants different imagery and one
  // of these genuinely fits, the AI should point at it directly rather
  // than requesting a new AI generation.
  availablePhotos: { id: string; fileName: string }[];
}

export interface EditPosterOutput {
  // False for the free/template tier (genuinely no AI available to
  // interpret free-form instructions — unlike original generation,
  // there's no honest deterministic fallback for this), OR when a real
  // shared-pool attempt was genuinely made but failed this one time
  // (exhaustion, a transient error) — see shared-pool.ts's editPosterSpec
  // wiring, which distinguishes these two cases in unavailableReason's
  // wording rather than showing "no provider" for a provider that does
  // exist and just failed once. True for a real BYOK or successful
  // shared-pool call, regardless of whether it could satisfy the
  // specific instruction.
  available: boolean;
  unavailableReason?: string;
  // Set together: the AI's real understanding of what it changed (or
  // honestly couldn't) — always shown to the user, never silently
  // dropped, per this feature's own honest-scope-boundary requirement.
  updatedSpec?: PosterEditSpec;
  explanation?: string;
  // Set when the AI decided new/different imagery is needed and no
  // availablePhotos entry genuinely fit — a real request for the
  // existing AI background pipeline to fulfill as a separate step, not
  // an image this method generates itself.
  newImageRequest?: string;
  providerName: string;
  model?: string;
  estimatedCostUsd?: number;
  fallbackFrom?: FallbackInfo[];
}

// Smarter topic suggestions (2026-09-04) — the AI-driven half. Grounded
// in two real, already-existing inputs only: business context already
// extracted (CompanyContext) and real learned preference signals
// (Creative DNA's confidenceScores — see getLearnedTopicSignals in
// company-context.ts). Real-time "what's trending in [industry] right
// now" was investigated and deliberately excluded from this pass:
// Gemini's real google_search grounding tool cannot be combined with
// responseSchema in the same call (confirmed against Google's own docs
// and a corroborating googleapis/python-genai issue) — a 2-call
// pipeline would work but roughly doubles cost/latency per suggestion
// for an uncertain relevance payoff, and the user chose to skip it
// rather than build that speculatively. Revisit if that API constraint
// ever changes.
export interface LearnedTopicSignal {
  // The real campaignType category this signal is about (e.g.
  // "Educational", "Product Launch") — never a fabricated label.
  label: string;
  // Which real signal source this came from — kept raw/factual (see
  // buildTopicSuggestionsPrompt) rather than pre-classified into a
  // binary "liked/disliked" here, so the prompt states the real number
  // rather than this code's own interpretation of it.
  kind: "engagement" | "preference";
  score: number;
  sampleSize: number;
}

export interface GenerateTopicSuggestionsInput {
  context: CompanyContext;
  // Only signals that already cleared CreativeDna's own real
  // sufficient-evidence bar (confidenceTier !== "low") — see
  // getLearnedTopicSignals. Empty array is a real, valid state (a new
  // company with no usage history yet), not an error.
  learnedSignals: LearnedTopicSignal[];
  count: number;
}

export interface GenerateTopicSuggestionsOutput {
  // False only for the free/template tier (genuinely no AI available to
  // reason about business context + learned signals — the free tier's
  // real fallback here is getTopicSuggestionChips's day-rotated pool,
  // not a fake personalized answer), OR when a real shared-pool attempt
  // was genuinely made but failed this one time — same distinction
  // EditPosterOutput's own doc comment establishes, wired the same way
  // in shared-pool.ts.
  available: boolean;
  unavailableReason?: string;
  suggestions?: { label: string; topic: string }[];
  providerName: string;
  model?: string;
  estimatedCostUsd?: number;
}

export interface TextProvider {
  readonly name: string;
  generateReply(input: GenerateReplyInput): Promise<GenerateReplyOutput>;
  generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionOutput>;
  generateScript(input: GenerateScriptInput): Promise<GenerateScriptOutput>;
  generateCampaignBrief(input: GenerateCampaignBriefInput): Promise<GenerateCampaignBriefOutput>;
  expandBackgroundPrompt(input: ExpandBackgroundPromptInput): Promise<ExpandBackgroundPromptOutput>;
  summarizeBusinessContext(input: SummarizeBusinessContextInput): Promise<SummarizeBusinessContextOutput>;
  clarifyTopic(input: ClarifyTopicInput): Promise<ClarifyTopicOutput>;
  generatePosterHighlights(input: GeneratePosterHighlightsInput): Promise<GeneratePosterHighlightsOutput>;
  editPosterSpec(input: EditPosterInput): Promise<EditPosterOutput>;
  generateTopicSuggestions(input: GenerateTopicSuggestionsInput): Promise<GenerateTopicSuggestionsOutput>;
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
