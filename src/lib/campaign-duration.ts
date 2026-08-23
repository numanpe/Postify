// Real, existing cadence assumption reused here, not reinvented: the
// Campaign Generator (src/lib/actions/campaign.ts's createCampaign,
// src/lib/providers/text/template-provider.ts's generateCampaignBrief)
// already means exactly one asset per calendar day, capped at 14 days
// (CreateCampaignSchema's own real max) — this module only extracts a
// day count from natural-language text, it never invents a different
// cadence or a different cap.
export const MAX_CAMPAIGN_DAYS = 14;

export interface ParsedDurationRequest {
  // Already clamped to MAX_CAMPAIGN_DAYS — always safe to feed straight
  // into the campaign form's `days` field.
  days: number;
  // The real, un-clamped number the text implied — lets the caller show
  // an honest "you asked for N, this app does up to 14 at a time"
  // message instead of silently substituting a smaller number.
  requestedDays: number;
  wasCapped: boolean;
  // The original text with the duration phrase (and common request
  // scaffolding like "give me"/"content for") stripped out — a real
  // bug found during this feature's own verification: routing the raw
  // text straight into the Campaign Generator as the objective put
  // "give me 2 weeks of" into the actual generated marketing copy
  // ("Introducing give me 2 weeks of content for our new organic
  // tomato line."). This is a best-effort cleanup, not true NLU — it
  // won't be perfect for every phrasing, but it's what actually gets
  // used as the objective, never the raw request.
  cleanedObjective: string;
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  couple: 2,
  few: 3,
};

function toNumber(token: string): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return WORD_NUMBERS[token.toLowerCase()] ?? null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Regex-based on purpose, not a full NLU parser: covers the real
// phrasings this app's own spec examples use ("the next 7 days," "2
// weeks of posts," "a month of content") plus common variants ("a
// couple of weeks"), not every possible way to say a duration in
// English. A miss just means no suggestion is shown — the caller falls
// back to normal single-asset generation, never a wrong guess forced
// on the user (see CampaignForm/WizardStep1Form: this is always an
// optional, dismissible suggestion, never an auto-submit).
const UNIT_PATTERNS: { unit: "days" | "weeks" | "months"; regex: RegExp; multiplier: number }[] = [
  { unit: "days", regex: /\b(\d+|[a-z]+)\s*(?:of\s+)?days?\b/i, multiplier: 1 },
  { unit: "weeks", regex: /\b(\d+|[a-z]+)\s*(?:of\s+)?weeks?\b/i, multiplier: 7 },
  // A "month" is treated as ~30 days purely to decide how much this
  // implies relative to the real 14-day cap — it always gets clamped,
  // so the imprecision never reaches real scheduling.
  { unit: "months", regex: /\b(\d+|[a-z]+)\s*(?:of\s+)?months?\b/i, multiplier: 30 },
];

// Common request scaffolding around a duration phrase that reads as an
// instruction to the app, not as part of the actual marketing
// objective — stripped so what's left is usable as a real campaign
// objective. Order matters: longer/more specific phrases first so they
// match before a shorter word inside them would.
const FILLER_PHRASES = [
  "give me",
  "i'd like",
  "i want",
  "can you make",
  "can you create",
  "content for",
  "content about",
  "posts for",
  "posts about",
  "generate",
  "create",
  "make me",
  "make",
  "please",
  "for the next",
  "over the next",
  "the next",
  "next",
];

function cleanObjective(text: string, matchedPhrase: string): string {
  let cleaned = text.replace(new RegExp(escapeRegExp(matchedPhrase), "i"), " ");
  for (const phrase of FILLER_PHRASES) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi"), " ");
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  // A leftover leading connector ("of our spring sale", "for our
  // tomatoes") reads better dropped.
  cleaned = cleaned.replace(/^(of|for)\s+/i, "").trim();
  if (!cleaned) return text.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function parseDurationRequest(text: string): ParsedDurationRequest | null {
  for (const { regex, multiplier } of UNIT_PATTERNS) {
    const match = regex.exec(text);
    if (!match) continue;
    const n = toNumber(match[1]);
    if (!n || n <= 0) continue;

    const requestedDays = n * multiplier;
    const days = Math.min(requestedDays, MAX_CAMPAIGN_DAYS);
    return {
      days,
      requestedDays,
      wasCapped: requestedDays > MAX_CAMPAIGN_DAYS,
      cleanedObjective: cleanObjective(text, match[0]),
    };
  }
  return null;
}
