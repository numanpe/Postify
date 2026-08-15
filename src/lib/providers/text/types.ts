import type { CompanyContext } from "@/lib/company-context";

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

export interface GenerateCampaignPlanInput {
  context: CompanyContext;
  objective: string;
  itemCount: number;
}

export interface GenerateCampaignPlanOutput {
  // Exactly itemCount entries, one distinct angle per scheduled day —
  // a coherent arc (e.g. announce -> feature -> social proof -> urgency
  // -> recap), not itemCount unrelated topics.
  angles: string[];
  providerName: string;
  model?: string;
  estimatedCostUsd?: number;
}

export interface TextProvider {
  readonly name: string;
  generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionOutput>;
  generateScript(input: GenerateScriptInput): Promise<GenerateScriptOutput>;
  generateCampaignPlan(input: GenerateCampaignPlanInput): Promise<GenerateCampaignPlanOutput>;
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
