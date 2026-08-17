import "server-only";

import type { VoiceProvider, GenerateNarrationInput, GenerateNarrationOutput, WordTimestamp } from "./types";
import { VoiceProviderError } from "./types";
import { fetchWithRetry } from "../http";

// A stable, long-standing premade ElevenLabs voice ("Rachel") used as
// the single default — this app doesn't expose per-generation voice
// picking (same "two-click" simplicity as every other provider here).
// eleven_multilingual_v2 covers Arabic and English with one voice ID,
// so no separate voice-per-language branching is needed the way
// edge-voice-provider.ts needs for its locale-specific voices.
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = "eleven_multilingual_v2";

interface TimestampsResponse {
  audio_base64: string;
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

// BYOK. Real per-character timestamps from ElevenLabs' own
// with-timestamps endpoint, aggregated into word-level entries by
// splitting on whitespace — not estimated from words-per-minute.
export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly name = "ElevenLabs";

  constructor(private readonly apiKey: string) {}

  async generateNarration({ text }: GenerateNarrationInput): Promise<GenerateNarrationOutput> {
    let response: Response;
    try {
      response = await fetchWithRetry(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.apiKey,
          },
          body: JSON.stringify({ text, model_id: MODEL_ID }),
        },
        60_000,
      );
    } catch (error) {
      throw new VoiceProviderError(this.name, "Could not reach ElevenLabs (network error or timeout).", error);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new VoiceProviderError(this.name, "ElevenLabs rejected the API key — check it in Settings.");
      }
      if (response.status === 429) {
        throw new VoiceProviderError(this.name, "ElevenLabs rate-limited this request. Try again shortly.");
      }
      const body = await response.text().catch(() => "");
      throw new VoiceProviderError(
        this.name,
        `ElevenLabs text-to-speech request failed (${response.status}). ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as TimestampsResponse;
    const audioBuffer = Buffer.from(data.audio_base64, "base64");
    if (audioBuffer.byteLength === 0) {
      throw new VoiceProviderError(this.name, "ElevenLabs returned no audio data.");
    }
    if (!data.alignment || data.alignment.characters.length === 0) {
      throw new VoiceProviderError(this.name, "ElevenLabs returned no timing data for this script.");
    }

    const words = groupCharactersIntoWords(data.alignment);
    if (words.length === 0) {
      throw new VoiceProviderError(this.name, "ElevenLabs returned no word timestamps for this script.");
    }

    return {
      audioBuffer,
      mimeType: "audio/mpeg",
      durationSec: data.alignment.character_end_times_seconds[data.alignment.character_end_times_seconds.length - 1],
      words,
      providerName: this.name,
    };
  }
}

function groupCharactersIntoWords(alignment: NonNullable<TimestampsResponse["alignment"]>): WordTimestamp[] {
  const words: WordTimestamp[] = [];
  let current: { chars: string[]; start: number; end: number } | null = null;

  for (let i = 0; i < alignment.characters.length; i += 1) {
    const char = alignment.characters[i];
    if (/\s/.test(char)) {
      if (current) {
        words.push({ word: current.chars.join(""), startSec: current.start, endSec: current.end });
        current = null;
      }
      continue;
    }
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];
    if (!current) {
      current = { chars: [char], start, end };
    } else {
      current.chars.push(char);
      current.end = end;
    }
  }
  if (current) {
    words.push({ word: current.chars.join(""), startSec: current.start, endSec: current.end });
  }

  return words;
}
