export interface GenerateBackgroundInput {
  companyName: string;
  industry: string;
  tone: string;
  topic: string;
  widthPx: number;
  heightPx: number;
}

export interface GenerateBackgroundOutput {
  buffer: Buffer;
  mimeType: string;
  providerName: string;
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
