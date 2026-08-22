// Part 4.1's "capture what specifically changed, not just that an edit
// happened" — a real, lightweight word-level diff, not full NLP. Good
// enough to spot a genuinely recurring pattern (the company always
// removes a certain phrase, always shortens) over enough edits, which
// is the actual bar Part 4.1 sets ("over enough edits, recurring
// patterns are a genuinely strong signal") — a single edit's diff is
// just recorded as metadata, never acted on alone.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for",
  "with", "is", "are", "this", "that", "your", "our", "you", "we",
]);

function significantWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g)?.filter((w) => !STOPWORDS.has(w) && w.length > 2) ?? [];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface EditDiffSummary {
  originalWordCount: number;
  editedWordCount: number;
  wordCountDelta: number; // negative = shortened
  removedWords: string[];
  addedWords: string[];
}

// Returns null when there's no meaningful edit (identical after
// whitespace normalization) — a caption resubmitted byte-for-byte
// isn't a real edit signal.
export function summarizeCaptionEdit(original: string, edited: string): EditDiffSummary | null {
  const normOriginal = original.trim().replace(/\s+/g, " ");
  const normEdited = edited.trim().replace(/\s+/g, " ");
  if (normOriginal.toLowerCase() === normEdited.toLowerCase()) return null;

  const originalSet = new Set(significantWords(normOriginal));
  const editedSet = new Set(significantWords(normEdited));

  return {
    originalWordCount: wordCount(normOriginal),
    editedWordCount: wordCount(normEdited),
    wordCountDelta: wordCount(normEdited) - wordCount(normOriginal),
    removedWords: [...originalSet].filter((w) => !editedSet.has(w)),
    addedWords: [...editedSet].filter((w) => !originalSet.has(w)),
  };
}
