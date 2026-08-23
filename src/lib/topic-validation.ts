// Real, root-cause fix for the "make a poster about rentsmartcars.com,
// please search" bug class — catches clearly-malformed topic input
// before it ever reaches a caption/script template, regardless of how
// it got there (a suggestion click from topic-suggestions.tsx always
// produces clean text, so this only ever fires on free-typed input).
// Deliberately isomorphic (no "server-only") — used for instant client
// UI feedback and as the real server-side enforcement backstop
// (topic-guard.ts), same function both places so they can never drift.
export type TopicFlagReason = "meta-instruction" | "bare-url" | "too-long";

export interface TopicValidationResult {
  flagged: boolean;
  reason: TopicFlagReason | null;
}

// A "topic" is a short subject phrase ("New spring menu launch"), not
// a paragraph — generous thresholds (real topics/suggestions in this
// app run 2-8 words) so this only catches genuinely implausible input,
// never a normal richer topic.
const MAX_WORDS = 15;
const MAX_CHARS = 100;

// The user describing the task to the app ("make a poster about X"),
// not naming a subject. Verb + content-type noun, not a substring
// match — a real topic like "Poster design tips for small shops"
// shouldn't be flagged just because it contains "poster".
const META_INSTRUCTION_PATTERN =
  /\b(make|create|generate|write|design|build)\s+(?:me\s+)?(?:a|an|the|some)?\s*(poster|video|caption|post|ad|advertisement|image|graphic|content|reel|story)\b/i;

// Conversational meta-phrases that only make sense as an instruction
// to the app, never as part of a real topic — includes "please search"
// specifically, the literal phrase from the reported bug.
const REQUEST_PHRASE_PATTERN = /\b(please\s+(search|help|find|look\s?up)|can\s+you|could\s+you)\b/i;

// A bare domain/URL as the primary content — real topics don't read
// like "rentsmartcars.com".
const URL_PATTERN = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|co|ae|shop|store|biz|info)\b/i;

export function validateTopic(text: string): TopicValidationResult {
  const trimmed = text.trim();
  if (!trimmed) return { flagged: false, reason: null };

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_WORDS || trimmed.length > MAX_CHARS) {
    return { flagged: true, reason: "too-long" };
  }
  if (META_INSTRUCTION_PATTERN.test(trimmed) || REQUEST_PHRASE_PATTERN.test(trimmed)) {
    return { flagged: true, reason: "meta-instruction" };
  }
  if (URL_PATTERN.test(trimmed)) {
    return { flagged: true, reason: "bare-url" };
  }
  return { flagged: false, reason: null };
}
