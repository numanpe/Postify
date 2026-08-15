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

export interface TextProvider {
  readonly name: string;
  generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionOutput>;
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
