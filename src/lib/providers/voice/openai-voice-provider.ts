import "server-only";

import type { VoiceProvider, GenerateNarrationInput, GenerateNarrationOutput, WordTimestamp } from "./types";
import { VoiceProviderError } from "./types";
import { fetchWithRetry } from "../http";

const TTS_MODEL = "tts-1";
const TRANSCRIBE_MODEL = "whisper-1";

interface WhisperWordsResponse {
  duration?: number;
  words?: { word: string; start: number; end: number }[];
}

// BYOK only — see README.md for why the free tier ships without
// narration. Two real API calls, not one: synthesize speech, then
// transcribe that same audio back to recover real word-level
// timestamps (Whisper's timestamp_granularities=word), rather than
// estimating timing from a words-per-minute guess.
export class OpenAIVoiceProvider implements VoiceProvider {
  readonly name = "OpenAI";

  constructor(private readonly apiKey: string) {}

  async generateNarration({ text }: GenerateNarrationInput): Promise<GenerateNarrationOutput> {
    const audioBuffer = await this.synthesizeSpeech(text);
    const { durationSec, words } = await this.transcribeWithTimestamps(audioBuffer);

    return {
      audioBuffer,
      mimeType: "audio/mpeg",
      durationSec,
      words,
      providerName: this.name,
    };
  }

  private async synthesizeSpeech(text: string): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetchWithRetry(
        "https://api.openai.com/v1/audio/speech",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: TTS_MODEL,
            voice: "alloy",
            input: text,
            response_format: "mp3",
          }),
        },
        60_000,
      );
    } catch (error) {
      throw new VoiceProviderError(this.name, "Could not reach OpenAI (network error or timeout).", error);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new VoiceProviderError(this.name, "OpenAI rejected the API key — check it in Settings.");
      }
      if (response.status === 429) {
        throw new VoiceProviderError(this.name, "OpenAI rate-limited this request. Try again shortly.");
      }
      const body = await response.text().catch(() => "");
      throw new VoiceProviderError(
        this.name,
        `OpenAI text-to-speech request failed (${response.status}). ${body.slice(0, 200)}`,
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private async transcribeWithTimestamps(
    audioBuffer: Buffer,
  ): Promise<{ durationSec: number; words: WordTimestamp[] }> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" }), "narration.mp3");
    form.append("model", TRANSCRIBE_MODEL);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");

    let response: Response;
    try {
      response = await fetchWithRetry(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}` },
          body: form,
        },
        60_000,
      );
    } catch (error) {
      throw new VoiceProviderError(this.name, "Could not reach OpenAI (network error or timeout).", error);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new VoiceProviderError(this.name, "OpenAI rejected the API key — check it in Settings.");
      }
      const body = await response.text().catch(() => "");
      throw new VoiceProviderError(
        this.name,
        `OpenAI transcription request failed (${response.status}). ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as WhisperWordsResponse;
    if (!data.words || data.words.length === 0) {
      throw new VoiceProviderError(this.name, "OpenAI returned no word timestamps for the narration.");
    }

    return {
      durationSec: data.duration ?? data.words[data.words.length - 1].end,
      words: data.words.map((w) => ({ word: w.word, startSec: w.start, endSec: w.end })),
    };
  }
}
