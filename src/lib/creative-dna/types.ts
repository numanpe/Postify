// Shared shape of CreativeDna.confidenceScores — split out so
// learning.ts (real-engagement topics/peakPublishHours) and
// aggregate.ts (everyday-usage preferences) can both reference the
// same interfaces without importing from each other.

export interface TopicScore {
  relativeScore: number; // 2.8 means "2.8x the company's own average engagement"
  sampleSize: number;
  confidenceTier: "low" | "medium" | "high";
  updatedAt: string;
}

export interface PeakPublishHour {
  hourGst: number; // 0-23, Gulf Standard Time (UTC+4)
  sampleSize: number;
  confidenceTier: "low" | "medium" | "high";
  updatedAt: string;
}

export interface PreferenceScore {
  // Decayed, weighted sum across every contributing signal — roughly
  // -N..+N, unbounded, deliberately NOT clamped/floored here (that
  // happens only where a score gets consumed to bias a suggestion —
  // see pickPreferredTemplate in template-preference.ts).
  score: number;
  sampleSize: number;
  confidenceTier: "low" | "medium" | "high";
  updatedAt: string;
}

export interface CreativeDnaPreferences {
  topics: Record<string, PreferenceScore>;
  templates: Record<string, PreferenceScore>;
  tones: Record<string, PreferenceScore>;
  visualStyles: Record<string, PreferenceScore>;
}

export interface CreativeDnaConfidenceScores {
  topics: Record<string, TopicScore>;
  peakPublishHours?: PeakPublishHour;
  // Written independently by aggregate.ts's recomputeCreativeDnaPreferences
  // — everyday-usage signals (delete/publish/edit/regenerate/engagement-
  // as-correction), deliberately kept separate from the real-engagement
  // `topics` above rather than merged into one number (see aggregate.ts's
  // own doc comment for why).
  preferences?: CreativeDnaPreferences;
}
