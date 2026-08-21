import "server-only";

import type {
  TextProvider,
  GenerateCaptionInput,
  GenerateCaptionOutput,
  GenerateScriptInput,
  GenerateScriptOutput,
  GenerateCampaignBriefInput,
  GenerateCampaignBriefOutput,
  CampaignBriefItem,
  ExpandBackgroundPromptInput,
  ExpandBackgroundPromptOutput,
} from "./types";
import { INDUSTRY_COMPOSITION_STYLE, type Industry } from "@/lib/industry-packs";
import { isArabicScript } from "@/lib/poster/direction";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

// User-typed topics arrive lowercase more often than not, but templates
// splice {{topic}} into sentence-initial position sometimes ("{{topic}}
// — personalized...") and mid-sentence other times ("Ask about
// {{topic}}..."). Capitalizing every sentence start after assembly
// handles both without per-template bookkeeping.
function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

// Deterministic, not random: same company + topic always produces the
// same caption/script. That's a feature (consistent brand voice) and
// it keeps this honestly "rule-based" rather than faking AI-style
// variation.
function pickIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function hasCompanyToken(template: string): boolean {
  return template.includes("{{company}}");
}

interface PickResult {
  text: string;
  usedCompany: boolean;
}

// Real bug found by reading the actual industry-pack content: CTA
// pools are almost always 100% {{company}}-referencing ("Visit
// {{company}} this week..."), and hook/valueProp pools reference it
// 30-70% of the time too. Picking independently from each pool (the
// original behavior) regularly repeated the real company name twice —
// sometimes three times — in one short assembled caption/script/
// campaign item, which reads exactly like the kind of robotic AI
// output CLAUDE.md's quality bar rules out. companyAlreadyUsed lets
// each caller avoid a company-referencing template once an earlier
// slot in the same output already used one, falling back to the full
// pool only if a pack genuinely has zero non-company options left
// (rather than ever throwing).
function pick(
  seed: string,
  tag: string,
  options: string[],
  vars: Record<string, string>,
  companyAlreadyUsed = false,
): PickResult {
  const withoutCompany = options.filter((o) => !hasCompanyToken(o));
  const pool = companyAlreadyUsed && withoutCompany.length > 0 ? withoutCompany : options;
  const chosen = pool[pickIndex(`${seed}:${tag}`, pool.length)];
  return { text: capitalizeSentences(fillTemplate(chosen, vars)), usedCompany: hasCompanyToken(chosen) };
}

// A fixed marketing arc, not itemCount unrelated topics — this is what
// makes the free tier's plan "coherent" per CLAUDE.md's acceptance
// line. Two variants per stage so a typical week (5-7 items) doesn't
// repeat an exact angle; longer campaigns cycle back through the arc.
const CAMPAIGN_ARC: string[][] = [
  ["Introducing {{objective}}.", "Here's what's new: {{objective}}."],
  ["What makes {{objective}} worth it.", "A closer look at {{objective}}."],
  ["Why people are talking about {{objective}}.", "See what others are saying about {{objective}}."],
  ["Don't miss out on {{objective}}.", "Time's running out for {{objective}}."],
  ["One last look at {{objective}}.", "Before it's gone: {{objective}}."],
];

// Real keyword matching against the objective text, not a random
// label — deliberately not an exhaustive enum (see CampaignBriefOutput's
// doc comment): any objective that doesn't match a known pattern gets
// "General" rather than a forced, wrong category.
function inferCampaignType(objective: string): string {
  const lower = objective.toLowerCase();
  if (/\blaunch/.test(lower)) return "Product Launch";
  if (/\b(sale|discount|% ?off|deal|clearance)\b/.test(lower)) return "Seasonal Sale";
  if (/\b(course|class|workshop|learn|training|webinar)\b/.test(lower)) return "Educational";
  if (/\b(flash|today only|limited time|24 ?hours?|this week only)\b/.test(lower)) return "Flash Promo";
  if (/\b(customer|testimonial|review|story|success story)\b/.test(lower)) return "Customer Story";
  return "General";
}

// A short, 2-5 word poster headline (per the spec's own example) —
// distinct from the longer, sentence-length `hooks` used for
// captions/scripts.
function shortHeadline(seed: string, options: string[]): string {
  return options[pickIndex(seed, options.length)];
}

// The zero-key free path: industry pack + company context filled into
// templates, no LLM call, works everywhere, never fails or rate-limits.
export class TemplateTextProvider implements TextProvider {
  readonly name = "Free (template)";

  async generateCaption({ context, topic, variantIndex }: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    const { pack, name, secondaryNiches, companyId } = context;
    const vars = { company: name, topic, niches: secondaryNiches.join(", ") };
    // Same topic + same companyId is otherwise fully deterministic (see
    // GenerateCaptionInput.variantIndex's doc comment) — folding the
    // index into the seed is what makes a real "generate 3 variants"
    // caller (repurpose.ts) get 3 different picks instead of 3 copies.
    const seed = `${companyId}:${topic}${variantIndex !== undefined ? `:${variantIndex}` : ""}`;

    const hook = pick(seed, "h", pack.hooks, vars);
    const valueProp = pick(seed, "v", pack.valueProps, vars, hook.usedCompany);
    const cta = pick(seed, "c", pack.ctas, vars, hook.usedCompany || valueProp.usedCompany);
    const nicheLine = secondaryNiches.length
      ? ` Specializing in ${secondaryNiches.join(", ")}.`
      : "";

    const text = `${hook.text} ${valueProp.text}${nicheLine} ${cta.text}`.replace(/\s+/g, " ").trim();

    return { text, providerName: this.name };
  }

  async generateScript({ context, topic }: GenerateScriptInput): Promise<GenerateScriptOutput> {
    const { pack, name, secondaryNiches, companyId } = context;
    const vars = { company: name, topic, niches: secondaryNiches.join(", ") };
    const seed = `${companyId}:${topic}:script`;

    // Sequential — each section only avoids repeating the company name
    // if an earlier section (in hook -> context -> value -> message ->
    // cta order) already used it, same as generateCaption above.
    const hook = pick(seed, "h", pack.hooks, vars);
    const scriptContext = pick(seed, "sc", pack.scriptContexts, vars, hook.usedCompany);
    const value = pick(seed, "v", pack.valueProps, vars, hook.usedCompany || scriptContext.usedCompany);
    const message = pick(
      seed,
      "sm",
      pack.scriptMessages,
      vars,
      hook.usedCompany || scriptContext.usedCompany || value.usedCompany,
    );
    const cta = pick(
      seed,
      "c",
      pack.ctas,
      vars,
      hook.usedCompany || scriptContext.usedCompany || value.usedCompany || message.usedCompany,
    );

    return {
      script: {
        hook: hook.text,
        context: scriptContext.text,
        value: value.text,
        message: message.text,
        cta: cta.text,
      },
      providerName: this.name,
    };
  }

  // The AI Creative Director's free tier: no LLM call, so campaign
  // type, headlines, and hashtags all come from real, hand-written
  // industry-pack content and deterministic keyword matching — not
  // generative, but genuinely differentiated by industry/objective, and
  // by construction contains none of the banned filler words (they were
  // never written into the packs).
  async generateCampaignBrief({
    context,
    objective,
    itemCount,
    scheduledDates,
    connectedPlatforms,
  }: GenerateCampaignBriefInput): Promise<GenerateCampaignBriefOutput> {
    const { pack, name, secondaryNiches, companyId } = context;
    const vars = { company: name, objective, niches: secondaryNiches.join(", ") };
    const campaignType = inferCampaignType(objective);

    const items: CampaignBriefItem[] = [];
    for (let i = 0; i < itemCount; i += 1) {
      const stage = CAMPAIGN_ARC[i % CAMPAIGN_ARC.length];
      const variant = stage[Math.floor(i / CAMPAIGN_ARC.length) % stage.length];
      const angle = capitalizeSentences(fillTemplate(variant, vars));

      const seed = `${companyId}:${objective}:${i}`;
      // {{topic}} here is the raw objective, not `angle` — `angle` is
      // already a full sentence (CAMPAIGN_ARC wrapped it), and these
      // hook/valueProp/cta templates ALSO wrap {{topic}} into a
      // sentence ("{{topic}} — grown with care..."); splicing a
      // sentence into a sentence produced real grammatically broken
      // output ("We put the same care into What makes X worth it. That
      // we put into..."), caught by generating and visually inspecting
      // a real poster. Matches how generateCaption/generateScript
      // already use their raw `topic` input directly, with no
      // second wrapping layer.
      const topicVars = { ...vars, topic: objective };
      const hook = pick(seed, "h", pack.hooks, topicVars);
      const valueProp = pick(seed, "v", pack.valueProps, topicVars, hook.usedCompany);
      const cta = pick(seed, "c", pack.ctas, topicVars, hook.usedCompany || valueProp.usedCompany);
      const captionText = `${hook.text} ${valueProp.text} ${cta.text}`.replace(/\s+/g, " ").trim();

      // A multi-day campaign opens with a video (a stronger first
      // impression) and fills the rest with posters (cheaper, faster,
      // always free-tier viable) — a deliberate, deterministic mix, not
      // every item defaulting to the slower/heavier asset type.
      const assetType: CampaignBriefItem["assetType"] = i === 0 && itemCount > 1 ? "VIDEO" : "POSTER";

      // A single, honest constant post time rather than a fake
      // "AI-optimized" claim — this app has no real engagement
      // analytics yet to base a smarter suggestion on.
      const suggestedPostAt = `${scheduledDates[i]}T10:00:00.000Z`;

      items.push({
        assetType,
        angle,
        ...(assetType === "POSTER"
          ? { headline: shortHeadline(`${seed}:headline`, pack.shortHeadlines), subhead: valueProp.text, cta: cta.text }
          : { videoTopic: angle }),
        captionText,
        hashtags: pack.hashtags,
        suggestedPostAt,
        targetPlatforms: connectedPlatforms,
      });
    }

    return { campaignType, items, providerName: this.name };
  }

  // Deterministic, rule-based expansion — no LLM call, works with zero
  // keys. Still concrete rather than buzzwordy: weaves in the real
  // industry visual tone and the actual reading-direction/text-space
  // consequence for the chosen template, rather than a generic
  // "photorealistic, hyper-detailed" filler.
  async expandBackgroundPrompt(input: ExpandBackgroundPromptInput): Promise<ExpandBackgroundPromptOutput> {
    const {
      rawUserPrompt,
      industry,
      visualTone,
      forbiddenStyles,
      layoutDirection,
      aspectRatio,
      reservesTextSpace,
      accentColorsForBackground,
    } = input;

    const directionClause =
      layoutDirection === "RTL" ? "the headline will read right-to-left in Arabic" : "the headline will read left-to-right in English";

    const clearanceClause = reservesTextSpace
      ? ` Keep the lower portion of the frame visually calmer and less busy, since ${directionClause} and a dark gradient will sit over that area for legible overlaid text.`
      : ` This background will not have any text overlaid on it directly — ${directionClause} on a separate solid panel elsewhere on the poster.`;

    // The free image model doesn't reliably interpret non-Latin script
    // as a subject cue — verified live: an Arabic headline about grass
    // produced an unrelated portrait scene, while the same pipeline
    // with an English headline produced an accurate field photo. There
    // is no LLM here to translate the headline's meaning, so for
    // non-Latin script this anchors on the real, English, industry-
    // derived subject instead of embedding text the model can't use —
    // the poster's actual on-image text is unaffected, since that's
    // rendered separately by the (already RTL-correct) template, not
    // drawn by the image model.
    const article = /^[aeiou]/i.test(industry) ? "an" : "a";
    const subjectClause = isArabicScript(rawUserPrompt) ? `A background photo for ${article} ${industry} business` : rawUserPrompt;

    const expandedVisualPrompt = `${subjectClause}. ${visualTone}.${clearanceClause} No text, no logos, no watermarks in the image itself.`
      .replace(/\s+/g, " ")
      .trim();

    const negativePrompt = [...forbiddenStyles, "embedded text", "watermark", "logo", "blurry", "low quality"].join(", ");

    return {
      expandedVisualPrompt,
      negativePrompt,
      designParameters: {
        aspectRatio,
        colorPalette: accentColorsForBackground.slice(0, 3),
        compositionStyle: INDUSTRY_COMPOSITION_STYLE[industry as Industry] ?? "Minimalist",
      },
      providerName: this.name,
    };
  }
}
