import "server-only";

import type {
  TextProvider,
  GenerateReplyInput,
  GenerateReplyOutput,
  GenerateCaptionInput,
  GenerateCaptionOutput,
  GenerateScriptInput,
  GenerateScriptOutput,
  GenerateCampaignBriefInput,
  GenerateCampaignBriefOutput,
  CampaignBriefItem,
  ExpandBackgroundPromptInput,
  ExpandBackgroundPromptOutput,
  SummarizeBusinessContextInput,
  SummarizeBusinessContextOutput,
  ClarifyTopicOutput,
  GeneratePosterHighlightsInput,
  GeneratePosterHighlightsOutput,
  PosterBenefit,
  EditPosterOutput,
} from "./types";
import { INDUSTRY_COMPOSITION_STYLE, type Industry } from "@/lib/industry-packs";
import { isArabicScript } from "@/lib/poster/direction";
import { getCompanyTopicPool } from "@/lib/company-context";

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

// Real, deterministic text-to-hashtag derivation for the free tier —
// Part A of the local-content-awareness work. Splits on common
// separators ("&", ",", " and "), strips generic trailing words that
// aren't real place names, then title-cases each remaining word and
// joins with no spaces. Works for Arabic input too: .toUpperCase() is
// a no-op on Arabic script, so an Arabic target market just gets "#"
// prepended with spaces removed (a real, commonly-used hashtag form,
// e.g. #أبوظبي) rather than anything Latin-script-specific. Capped at
// 3 tags so a long free-text description doesn't flood the hashtag
// list — this is a supplement to the industry pack's own real tags,
// never a replacement for them.
const GENERIC_MARKET_WORDS = new Set(["region", "area", "nationwide", "market", "b2b", "b2c"]);

export function deriveMarketHashtags(targetMarket: string | null): string[] {
  if (!targetMarket) return [];
  return targetMarket
    .split(/[,&]|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part
        .split(/\s+/)
        .filter((word) => !GENERIC_MARKET_WORDS.has(word.toLowerCase()))
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(""),
    )
    .filter((tag) => tag.length > 1)
    .slice(0, 3)
    .map((tag) => `#${tag}`);
}

function hasCompanyToken(template: string): boolean {
  return template.includes("{{company}}");
}

function hasTopicToken(template: string): boolean {
  return template.includes("{{topic}}");
}

interface PickResult {
  text: string;
  usedCompany: boolean;
  usedTopic: boolean;
}

// Real bug found by reading the actual industry-pack content: CTA
// pools are almost always 100% {{company}}-referencing ("Visit
// {{company}} this week..."), and hook/valueProp pools reference it
// 30-70% of the time too. Picking independently from each pool (the
// original behavior) regularly repeated the real company name twice —
// sometimes three times — in one short assembled caption/script/
// campaign item, which reads exactly like the kind of robotic AI
// output CLAUDE.md's quality bar rules out. avoidCompany/avoidTopic let
// each caller steer away from a template that repeats a token an
// earlier slot in the same output already used, falling back to the
// unfiltered pool only if a pack genuinely has zero alternative options
// left (rather than ever throwing).
//
// {{topic}} got the exact same treatment after a real regenerated
// caption for RentSmart Cars showed it twice in one sentence: valueProps
// almost always reference {{topic}} (that's their whole purpose) and
// several industries' ctas ALSO reference it ("Let {{company}} take
// {{topic}} off your plate.") — with no guard, both slots fire whenever
// a pack pairs them, most jarring when topic is a short quotable phrase
// (e.g. an auto-generated shortHeadline) rather than a plain noun.
function pick(
  seed: string,
  tag: string,
  options: string[],
  vars: Record<string, string>,
  avoidCompany = false,
  avoidTopic = false,
): PickResult {
  let pool = options;
  if (avoidCompany) {
    const withoutCompany = pool.filter((o) => !hasCompanyToken(o));
    if (withoutCompany.length > 0) pool = withoutCompany;
  }
  if (avoidTopic) {
    const withoutTopic = pool.filter((o) => !hasTopicToken(o));
    if (withoutTopic.length > 0) pool = withoutTopic;
  }
  const chosen = pool[pickIndex(`${seed}:${tag}`, pool.length)];
  return {
    text: capitalizeSentences(fillTemplate(chosen, vars)),
    usedCompany: hasCompanyToken(chosen),
    usedTopic: hasTopicToken(chosen),
  };
}

// A fixed marketing arc, not itemCount unrelated topics — this is what
// makes the free tier's plan "coherent" per CLAUDE.md's acceptance
// line. Two variants per stage so a typical week (5-7 items) doesn't
// repeat an exact angle; longer campaigns cycle back through the arc.
const CAMPAIGN_ARC: string[][] = [
  ["Introducing {{topic}}.", "Here's what's new: {{topic}}."],
  ["What makes {{topic}} worth it.", "A closer look at {{topic}}."],
  ["Why people are talking about {{topic}}.", "See what others are saying about {{topic}}."],
  ["Don't miss out on {{topic}}.", "Time's running out for {{topic}}."],
  ["One last look at {{topic}}.", "Before it's gone: {{topic}}."],
];

// Real, confirmed-live bug (2026-09-02, found while verifying the new
// Arabic Real Estate pack): CAMPAIGN_ARC was English-only, so an
// Arabic company's `angle` field code-mixed an English wrapper sentence
// with the Arabic topic ("Introducing بحثك عن منزل.") — worse than just
// unlocalized, since `angle` becomes `videoTopic` for a campaign's
// video item and gets fed straight into generateScript as its actual
// topic. Same gender-agreement-safe discipline as INDUSTRY_PACKS_AR
// (industry-packs.ts) — {{topic}} only ever sits as a preposition's
// object or in colon apposition, never as a verb/adjective's subject.
const CAMPAIGN_ARC_AR: string[][] = [
  ["تعرّف على {{topic}}.", "الجديد لدينا: {{topic}}."],
  ["يستحق اهتمامك: {{topic}}.", "نظرة أقرب على {{topic}}."],
  ["الجميع يتحدث عن {{topic}}.", "شاهد ماذا يقول الآخرون عن {{topic}}."],
  ["لا تفوّت {{topic}}.", "الوقت ينفد بالنسبة لـ{{topic}}."],
  ["آخر فرصة لـ{{topic}}.", "قبل أن يفوتك: {{topic}}."],
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
//
// Exported as a real constant (not just a string literal on the class)
// because topic-guard.ts needs a reliable way to tell "this is the
// free tier" apart from BYOK — instanceof doesn't work there, since
// every real caller gets this wrapped in withDeletionAvoidance() (a
// plain object literal, not a class instance). `.name` is the one
// property that wrapper does forward correctly, so this constant keeps
// that one check in sync with the class automatically instead of
// duplicating the string.
export const FREE_TEXT_PROVIDER_NAME = "Free (template)";

// Honest scope limit, same reasoning as clarifyTopic's own doc comment
// (real language understanding needed to respond to specific arbitrary
// text): the free tier can't genuinely address what a customer actually
// said, so it doesn't try to fake that — these are real, usable generic
// acknowledgments (the kind of first-pass reply many real businesses
// already send), never dressed up as a considered response to the
// message's content. Kept short so it reads as a real reply, not a
// canned paragraph; always shown as an editable draft before Send, same
// as every other output here.
const REPLY_TEMPLATES: Record<"EN" | "AR", Record<"comment" | "dm", string[]>> = {
  EN: {
    comment: [
      "Thanks so much for the comment! Reach out anytime if there's more we can help with.",
      "Appreciate you taking the time to comment — happy to help with anything else.",
      "Thank you! Feel free to send us a message if you have questions.",
    ],
    dm: [
      "Thanks for reaching out — we've got your message and will follow up shortly.",
      "Thanks for the message! We'll get back to you with more details soon.",
      "Appreciate you contacting us — someone from our team will respond shortly.",
    ],
  },
  AR: {
    comment: [
      "شكرًا لتعليقك! لا تتردد في التواصل معنا إذا احتجت أي مساعدة أخرى.",
      "نقدّر وقتك في التعليق — يسعدنا مساعدتك في أي شيء آخر.",
      "شكرًا لك! لا تتردد في مراسلتنا إذا كانت لديك أسئلة.",
    ],
    dm: [
      "شكرًا لتواصلك معنا — استلمنا رسالتك وسنرد عليك قريبًا.",
      "شكرًا على رسالتك! سنوافيك بمزيد من التفاصيل قريبًا.",
      "نقدّر تواصلك معنا — سيرد عليك أحد أعضاء فريقنا قريبًا.",
    ],
  },
};

export class TemplateTextProvider implements TextProvider {
  readonly name = FREE_TEXT_PROVIDER_NAME;

  async generateReply({ context, incomingMessage, kind }: GenerateReplyInput): Promise<GenerateReplyOutput> {
    const options = REPLY_TEMPLATES[context.locale][kind];
    // Seeded on the incoming message itself (not companyId/topic like
    // generateCaption) — the same message always drafts the same
    // acknowledgment, but two different messages don't collide.
    const text = options[pickIndex(`${context.companyId}:${kind}:${incomingMessage}`, options.length)];
    return { text, providerName: this.name };
  }

  async generateCaption({ context, topic, variantIndex }: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    const { pack, name, tone, secondaryNiches, companyId, targetMarket, locale } = context;
    const vars = { company: name, topic, niches: secondaryNiches.join(", ") };
    // Same topic + same companyId is otherwise fully deterministic (see
    // GenerateCaptionInput.variantIndex's doc comment) — folding the
    // index into the seed is what makes a real "generate 3 variants"
    // caller (repurpose.ts) get 3 different picks instead of 3 copies.
    // tone is folded in too — real gap found during Part A2 testing:
    // CreativeDna.toneDescriptors (via context.tone) was computed and
    // passed through but never actually consulted by this deterministic
    // picker, so applying an extracted tone had zero visible effect on
    // free-tier output, failing CLAUDE.md's own "genuinely changes
    // generated output" bar. A fully free/local template system can't
    // do real tone-conditioned prose, but it CAN make tone a genuine
    // causal input to which hand-written, industry-appropriate phrase
    // gets selected — a real, reproducible, inspectable effect, not a
    // deep rewrite of the copy's register (that would need an LLM).
    const seed = `${companyId}:${tone}:${topic}${variantIndex !== undefined ? `:${variantIndex}` : ""}`;

    const hook = pick(seed, "h", pack.hooks, vars);
    const valueProp = pick(seed, "v", pack.valueProps, vars, hook.usedCompany, hook.usedTopic);
    const cta = pick(
      seed,
      "c",
      pack.ctas,
      vars,
      hook.usedCompany || valueProp.usedCompany,
      hook.usedTopic || valueProp.usedTopic,
    );
    // Real, confirmed-live gap (found while verifying the Arabic
    // industry packs, 2026-09-03): these two lines were hardcoded
    // English regardless of company.locale, so any AR company with
    // secondaryNiches/targetMarket set got an English sentence spliced
    // into an otherwise-fully-Arabic caption — the exact "English-plus-
    // a-translation-layer" failure CLAUDE.md's Arabic requirement
    // exists to prevent. Both AR phrasings are nominal/agentless
    // constructions on purpose: secondaryNiches and targetMarket are
    // arbitrary free text with unknown grammatical gender, so unlike
    // the industry packs' own {{topic}} rule (which controls the
    // template, not the filler), there's no way to conjugate a verb
    // to agree with them safely. "بخبرة خاصة في" has no verb at all;
    // "نخدم بفخر" conjugates for the company ("we"), never for the
    // market name that follows it as an object.
    const nicheLine = secondaryNiches.length
      ? locale === "AR"
        ? ` بخبرة خاصة في ${secondaryNiches.join("، ")}.`
        : ` Specializing in ${secondaryNiches.join(", ")}.`
      : "";
    // Real, not decorative — see Company.targetMarket's own schema
    // comment. Same "always the same sentence, never invented" honesty
    // this deterministic system already applies everywhere else.
    const marketLine = targetMarket
      ? locale === "AR"
        ? ` نخدم بفخر ${targetMarket}.`
        : ` Proudly serving ${targetMarket}.`
      : "";

    const text = `${hook.text} ${valueProp.text}${nicheLine}${marketLine} ${cta.text}`.replace(/\s+/g, " ").trim();

    return { text, providerName: this.name };
  }

  async generateScript({ context, topic, variantIndex }: GenerateScriptInput): Promise<GenerateScriptOutput> {
    const { pack, name, tone, secondaryNiches, companyId } = context;
    const vars = { company: name, topic, niches: secondaryNiches.join(", ") };
    // variantIndex folded in exactly like generateCaption above — real,
    // confirmed bug otherwise (see GenerateScriptInput's own doc
    // comment): 5 real repeat calls for the same topic returned 5
    // byte-identical scripts with no variantIndex to break the tie.
    const seed = `${companyId}:${tone}:${topic}:script${variantIndex !== undefined ? `:${variantIndex}` : ""}`;

    // Sequential — each section only avoids repeating the company name
    // if an earlier section (in hook -> context -> value -> message ->
    // cta order) already used it, same as generateCaption above.
    const hook = pick(seed, "h", pack.hooks, vars);
    const scriptContext = pick(seed, "sc", pack.scriptContexts, vars, hook.usedCompany, hook.usedTopic);
    const value = pick(
      seed,
      "v",
      pack.valueProps,
      vars,
      hook.usedCompany || scriptContext.usedCompany,
      hook.usedTopic || scriptContext.usedTopic,
    );
    const message = pick(
      seed,
      "sm",
      pack.scriptMessages,
      vars,
      hook.usedCompany || scriptContext.usedCompany || value.usedCompany,
      hook.usedTopic || scriptContext.usedTopic || value.usedTopic,
    );
    const cta = pick(
      seed,
      "c",
      pack.ctas,
      vars,
      hook.usedCompany || scriptContext.usedCompany || value.usedCompany || message.usedCompany,
      hook.usedTopic || scriptContext.usedTopic || value.usedTopic || message.usedTopic,
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
    itemAssetTypes,
  }: GenerateCampaignBriefInput): Promise<GenerateCampaignBriefOutput> {
    const { pack, name, tone, secondaryNiches, companyId, targetMarket } = context;
    const baseVars = { company: name, niches: secondaryNiches.join(", ") };
    const campaignType = inferCampaignType(objective);
    // Real, not decorative — see deriveMarketHashtags's own comment.
    // Appended to (never replacing) the industry pack's own real tags,
    // so every item keeps its genuinely industry-relevant hashtags too.
    const marketHashtags = deriveMarketHashtags(targetMarket);
    // Real, confirmed-live bug (2026-09-01 acceptance test, all 3
    // industries tested): every template below (CAMPAIGN_ARC included)
    // assumes {{topic}} is a short noun phrase ("our new irrigation
    // system"), but `objective` is free text from a "Describe the
    // campaign's objective" field — almost always a full sentence or
    // imperative ("Promote this week's heirloom apple harvest and
    // Saturday farm stand"), not a noun phrase. Splicing that raw
    // sentence into "Introducing {{topic}}." or "{{topic}} means
    // quality you can taste and trust" produced real, visibly broken
    // grammar in every generated item. `objective` still drives
    // inferCampaignType's keyword match and the Campaign row's own
    // internal name/objective fields — it's just never echoed verbatim
    // into what a customer actually reads. getCompanyTopicPool gives a
    // real, safe, per-company noun-phrase pool instead (same one
    // "Auto-Generate Daily Idea" already uses), rotated per item so a
    // multi-day campaign gets genuine day-to-day topic variety too,
    // not the same phrase re-templated itemCount times.
    const topicPool = getCompanyTopicPool(context);

    const items: CampaignBriefItem[] = [];
    for (let i = 0; i < itemCount; i += 1) {
      const vars = { ...baseVars, topic: topicPool[i % topicPool.length] };

      // Checks the pack's ACTUAL content, not just locale === "AR" —
      // an Arabic-locale company in an industry INDUSTRY_PACKS_AR
      // doesn't cover yet still gets the English pack (its own honest
      // fallback), and using locale alone here would mix this Arabic
      // wrapper with that pack's English topic pool ("تعرّف على this
      // week's harvest."), a new code-mixing bug from the same root
      // cause as the one this fix targets.
      const arc = isArabicScript(pack.hooks[0] ?? "") ? CAMPAIGN_ARC_AR : CAMPAIGN_ARC;
      const stage = arc[i % arc.length];
      const variant = stage[Math.floor(i / arc.length) % stage.length];
      const angle = capitalizeSentences(fillTemplate(variant, vars));

      const seed = `${companyId}:${tone}:${objective}:${i}`;
      const hook = pick(seed, "h", pack.hooks, vars);
      const valueProp = pick(seed, "v", pack.valueProps, vars, hook.usedCompany, hook.usedTopic);
      const cta = pick(
        seed,
        "c",
        pack.ctas,
        vars,
        hook.usedCompany || valueProp.usedCompany,
        hook.usedTopic || valueProp.usedTopic,
      );
      const captionText = `${hook.text} ${valueProp.text} ${cta.text}`.replace(/\s+/g, " ").trim();

      // A multi-day campaign opens with a video (a stronger first
      // impression) and fills the rest with posters (cheaper, faster,
      // always free-tier viable) — a deliberate, deterministic mix, not
      // every item defaulting to the slower/heavier asset type. An
      // explicit itemAssetTypes (the recurring daily content plan's own
      // "N videos + M posts" config) overrides this default entirely.
      const assetType: CampaignBriefItem["assetType"] =
        itemAssetTypes?.[i] ?? (i === 0 && itemCount > 1 ? "VIDEO" : "POSTER");

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
        hashtags: [...pack.hashtags, ...marketHashtags],
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

  // Real, honest heuristic — not an LLM call (per CLAUDE.md's free-first
  // rule, this capability can't require a paid key). Description is the
  // real extracted text itself, not a generated summary — the free tier
  // doesn't paraphrase, it just picks the most informative real string
  // already available (an explicit description beats raw body text,
  // which is noisier). products uses a real, disclosed heuristic (see
  // deriveProductsHeuristic below) — real signals actually pulled from
  // the site, an honest empty array when neither signal is present,
  // never a guessed/fabricated list. tone is a real measurement
  // (contraction/exclamation frequency, average sentence length), not
  // invented.
  async summarizeBusinessContext({
    ogDescription,
    metaDescription,
    visibleText,
    navLinkTexts,
  }: SummarizeBusinessContextInput): Promise<SummarizeBusinessContextOutput> {
    const description = (ogDescription ?? metaDescription ?? visibleText.slice(0, 220)).trim();
    const tone = detectToneHeuristic(visibleText || description);
    const products = deriveProductsHeuristic(navLinkTexts, description);
    return { description, products, tone, providerName: this.name };
  }

  // Real, honest "no" — per this method's own doc comment (types.ts),
  // extracting a real subject from malformed input needs actual
  // language understanding this deterministic tier doesn't have.
  // topic-guard.ts's real backstop treats a null here as "block and
  // ask the user to fix it", never as license to guess.
  async clarifyTopic(): Promise<ClarifyTopicOutput> {
    return { clarifiedTopic: null, providerName: this.name };
  }

  // INFOGRAPHIC_SHOWCASE template's free-tier fallback (2026-09-03) —
  // honest per GeneratePosterHighlightsInput's own doc comment: this
  // deterministic tier can't genuinely understand the specific
  // headline's semantics the way a real LLM call (the BYOK providers'
  // implementation) can, so rather than fake that specificity it reuses
  // real, already-differentiated per-industry content (pack.hooks/
  // valueProps — the same pools generateCaption already draws from),
  // picked deterministically so the same headline always yields the
  // same highlights.
  async generatePosterHighlights({ context, topic }: GeneratePosterHighlightsInput): Promise<GeneratePosterHighlightsOutput> {
    const { pack, name, companyId } = context;
    const vars = { company: name, topic, niches: "" };
    const seed = `${companyId}:highlights:${topic}`;

    const stripTrailingPeriod = (s: string) => s.replace(/\.\s*$/, "");

    const hookCount = pack.hooks.length;
    const benefitHeadlineIndexes = [0, 1, 2, 3].map((i) => pickIndex(`${seed}:bh${i}`, hookCount));
    const usedHeadlineIndexes = new Set<number>();
    const benefits: PosterBenefit[] = benefitHeadlineIndexes.map((idx, i) => {
      // Real distinctness, not just a seeded coincidence: if two of the
      // 3 picks landed on the same hook, walk forward to the next
      // unused one (wrapping) so a company never sees the same benefit
      // headline twice on one poster.
      let realIdx = idx;
      while (usedHeadlineIndexes.has(realIdx) && usedHeadlineIndexes.size < hookCount) {
        realIdx = (realIdx + 1) % hookCount;
      }
      usedHeadlineIndexes.add(realIdx);
      const headline = stripTrailingPeriod(fillTemplate(pack.hooks[realIdx], vars));
      const valueProp = pick(`${seed}:bv${i}`, "v", pack.valueProps, vars);
      return { headline, subtext: valueProp.text };
    });

    const remainingHookIndexes = Array.from({ length: hookCount }, (_, i) => i).filter((i) => !usedHeadlineIndexes.has(i));
    const badgePool = remainingHookIndexes.length >= 2 ? remainingHookIndexes : Array.from({ length: hookCount }, (_, i) => i);
    const badgeIndexes = [0, 1].map((i) => badgePool[pickIndex(`${seed}:tb${i}`, badgePool.length)]);
    const trustBadges = [...new Set(badgeIndexes)].map((idx) => stripTrailingPeriod(fillTemplate(pack.hooks[idx], vars)));

    return { benefits, trustBadges, providerName: this.name };
  }

  // Real, honest "no" — unlike original poster generation (which has a
  // genuine deterministic template path), interpreting an arbitrary
  // free-form edit instruction needs actual language understanding this
  // tier doesn't have. Same "no" as clarifyTopic's own doc comment, not
  // a fake best-effort attempt.
  async editPosterSpec(): Promise<EditPosterOutput> {
    return {
      available: false,
      unavailableReason: "Editing a poster with a written instruction needs a connected AI provider — add one in Settings.",
      providerName: this.name,
    };
  }
}

// A real, measurable signal (contraction density, exclamation marks,
// average sentence length) rather than a coin flip — genuinely
// different real sites (see brand-context.ts's verification) land on
// opposite sides of this. Not claimed as more than a heuristic: BYOK
// providers derive tone from actual language understanding instead.
function detectToneHeuristic(text: string): string {
  if (!text.trim()) return "clear, genuine, professional";
  const contractionCount = (text.match(/\b\w+'(?:re|ve|ll|d|s|t)\b/gi) ?? []).length;
  const exclamationCount = (text.match(/!/g) ?? []).length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.length ? text.length / sentences.length : 0;
  const casualSignal = contractionCount + exclamationCount * 2;
  return casualSignal >= 3 || avgSentenceLength < 60
    ? "casual, approachable, direct"
    : "formal, professional, polished";
}

// A real failure case found while verifying this against a realistic
// description ("...sourdough bread, croissants, custom cakes, and
// coffee, baked fresh daily.") — the trailing clause describes HOW the
// products are made, not another product, but a naive comma-split
// can't tell the two apart. A cheap, real fix: such clauses almost
// always open with a past-participle verb.
const TRAILING_CLAUSE_VERBS =
  /^(baked|made|served|brewed|roasted|crafted|prepared|sourced|grown|packed|shipped|delivered|cooked|handmade)\b/i;

function splitListPhrase(phrase: string): string[] {
  return phrase
    .split(/,|\band\b|&/i)
    .map((item) => item.trim().replace(/^(a|an|the)\s+/i, "").replace(/\.$/, ""))
    .filter(
      (item) =>
        item.length >= 2 &&
        item.length <= 40 &&
        !/^(more|etc\.?|so much more)$/i.test(item) &&
        !TRAILING_CLAUSE_VERBS.test(item),
    );
}

// Fallback for when the nav yields nothing usable: many real business
// descriptions explicitly list what they sell in exactly this shape
// ("a range of skincare, razors, and shave gel") — a real, common
// English pattern, not a guess at arbitrary prose.
const PRODUCT_LIST_PATTERNS = [
  /(?:range|selection|variety|collection|line|assortment) of ([^.!?]+)/i,
  /(?:offers?|offering|featuring|including) ([^.!?]+)/i,
];

function deriveProductsFromDescription(description: string): string[] {
  for (const pattern of PRODUCT_LIST_PATTERNS) {
    const match = pattern.exec(description);
    if (!match) continue;
    const items = splitListPhrase(match[1]);
    if (items.length > 0) return items.slice(0, 6);
  }
  return [];
}

// Real, disclosed heuristic — no LLM here, so no true language
// understanding, unlike the BYOK providers' real prompt-based
// extraction. Primary signal is the site's own real navigation menu
// (brand-extract.ts captures nav/header link text before those
// elements are stripped for the visibleText signal) — a business's
// own nav is usually the single most reliable non-LLM signal for what
// it actually sells ("Shop Razors", "Skincare", "Subscriptions").
// Falls back to parsing a comma-separated list out of the description
// when nav yields nothing useful. A real, honest empty array — never a
// fabricated guess — when neither signal is present.
function deriveProductsHeuristic(navLinkTexts: string[], description: string): string[] {
  if (navLinkTexts.length > 0) return navLinkTexts.slice(0, 6);
  return deriveProductsFromDescription(description);
}
