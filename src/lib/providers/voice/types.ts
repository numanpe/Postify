import type { FallbackInfo } from "../fallback-log";

export interface WordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
}

export interface GenerateNarrationInput {
  text: string;
}

export interface GenerateNarrationOutput {
  audioBuffer: Buffer;
  mimeType: string;
  durationSec: number;
  // Real per-word timestamps from transcribing the generated audio
  // (not estimated from words-per-minute) — this is what makes
  // captions genuinely "word-level" rather than approximate.
  words: WordTimestamp[];
  providerName: string;
  fallbackFrom?: FallbackInfo[];
}

export interface VoiceProvider {
  readonly name: string;
  generateNarration(input: GenerateNarrationInput): Promise<GenerateNarrationOutput>;
}

export class VoiceProviderError extends Error {
  constructor(
    public providerName: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "VoiceProviderError";
  }
}
