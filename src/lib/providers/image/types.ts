import type { FallbackInfo } from "../fallback-log";

export interface GenerateBackgroundInput {
  companyName: string;
  industry: string;
  tone: string;
  topic: string;
  widthPx: number;
  heightPx: number;
  // Poster generation's two-stage pipeline (background-context.ts +
  // TextProvider.expandBackgroundPrompt) supplies these — a richer,
  // brand-grounded prompt than the fields above alone can build. When
  // absent (video.ts's AI B-roll stills, which don't run that
  // pipeline), providers fall back to building a simpler prompt from
  // companyName/industry/tone/topic.
  expandedPrompt?: string;
  negativePrompt?: string;
}

export interface GenerateBackgroundOutput {
  buffer: Buffer;
  mimeType: string;
  providerName: string;
  fallbackFrom?: FallbackInfo[];
}

export interface ImageProvider {
  readonly name: string;
  generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput>;
}

// Same contract as text/types.ts's ProviderError: surfaced directly to
// the user, never swallowed into a silent fallback.
export class ImageProviderError extends Error {
  constructor(
    public providerName: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ImageProviderError";
  }
}
