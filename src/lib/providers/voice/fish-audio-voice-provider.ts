import "server-only";

import type { VoiceProvider, GenerateNarrationInput, GenerateNarrationOutput, WordTimestamp } from "./types";
import { VoiceProviderError } from "./types";
import { fetchWithRetry } from "../http";

// BYOK. Verified directly against Fish Audio's real, current API docs
// (docs.fish.audio) before writing this — same discipline as the
// Upload-Post aggregator adapter. The plain /v1/tts endpoint returns
// only raw audio with no timing data; this app needs the separate
// /v1/tts/stream/with-timestamp endpoint specifically for real
// word-level timestamps (computeSectionTimingsFromWords requires
// them — the same requirement that ruled out Piper as a local option).
// One real API call, not two like OpenAI's synthesize-then-transcribe
// — Fish Audio returns audio and word timing together in one stream.
const ENDPOINT = "https://api.fish.audio/v1/tts/stream/with-timestamp";

// Deliberately not pinned to a specific model (e.g. "s2.1-pro-free") —
// that free tier is time-limited (confirmed via Fish Audio's own blog:
// free access only through Aug 31, 2026) and hardcoding it here would
// silently start failing once it lapses. Omitting `model` lets Fish
// Audio apply its own account-appropriate default (s2.1-pro as of
// this writing) for whatever tier the user's real key is on.

interface FishAlignmentSegment {
  text: string;
  start: number;
  end: number;
}

interface FishStreamEvent {
  audio_base64?: string;
  content?: string;
  alignment?: { segments: FishAlignmentSegment[]; audio_duration: number } | null;
  chunk_seq?: number;
  chunk_audio_offset_sec?: number;
}

// S2.1 Pro supports 83 languages (including Arabic) with automatic
// language detection from the input text itself — confirmed via Fish
// Audio's own docs/blog. No separate voice-ID-per-language branching
// needed, same simplicity as ElevenLabs' eleven_multilingual_v2.
export class FishAudioVoiceProvider implements VoiceProvider {
  readonly name = "Fish Audio";

  constructor(private readonly apiKey: string) {}

  async generateNarration({ text }: GenerateNarrationInput): Promise<GenerateNarrationOutput> {
    let response: Response;
    try {
      response = await fetchWithRetry(
        ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ text, format: "mp3" }),
        },
        60_000,
      );
    } catch (error) {
      throw new VoiceProviderError(this.name, "Could not reach Fish Audio (network error or timeout).", error);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new VoiceProviderError(this.name, "Fish Audio rejected the API key — check it in Settings.");
      }
      if (response.status === 402) {
        throw new VoiceProviderError(this.name, "Fish Audio reports this account has no remaining balance/quota.");
      }
      if (response.status === 503) {
        throw new VoiceProviderError(this.name, "Fish Audio's servers are overloaded right now. Try again shortly.");
      }
      const body = await response.text().catch(() => "");
      throw new VoiceProviderError(
        this.name,
        `Fish Audio text-to-speech request failed (${response.status}). ${body.slice(0, 200)}`,
      );
    }
    if (!response.body) {
      throw new VoiceProviderError(this.name, "Fish Audio returned no response stream.");
    }

    const audioChunksInOrder: Buffer[] = [];
    // Alignment snapshots are cumulative per chunk_seq — a later event
    // for the same chunk_seq supersedes an earlier one (per Fish
    // Audio's own docs), so this must be a last-write-wins map, not an
    // append — appending would duplicate/desync words.
    const latestAlignmentByChunk = new Map<
      number,
      { segments: FishAlignmentSegment[]; offsetSec: number }
    >();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Standard SSE framing: events separated by a blank line, each
        // data line prefixed "data: ".
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const dataLines = rawEvent
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());
          if (dataLines.length === 0) continue;

          let event: FishStreamEvent;
          try {
            event = JSON.parse(dataLines.join(""));
          } catch {
            continue; // A non-JSON keepalive/comment frame, not a real event.
          }

          if (event.audio_base64) {
            audioChunksInOrder.push(Buffer.from(event.audio_base64, "base64"));
          }
          if (event.alignment && typeof event.chunk_seq === "number") {
            latestAlignmentByChunk.set(event.chunk_seq, {
              segments: event.alignment.segments,
              offsetSec: event.chunk_audio_offset_sec ?? 0,
            });
          }
        }
      }
    } catch (error) {
      throw new VoiceProviderError(this.name, "Fish Audio's response stream ended unexpectedly.", error);
    }

    if (audioChunksInOrder.length === 0) {
      throw new VoiceProviderError(this.name, "Fish Audio returned no audio data.");
    }
    const audioBuffer = Buffer.concat(audioChunksInOrder);

    const words: WordTimestamp[] = [...latestAlignmentByChunk.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([, { segments, offsetSec }]) =>
        segments.map((segment) => ({
          word: segment.text,
          startSec: segment.start + offsetSec,
          endSec: segment.end + offsetSec,
        })),
      );
    if (words.length === 0) {
      throw new VoiceProviderError(this.name, "Fish Audio returned no word timestamps for this script.");
    }

    return {
      audioBuffer,
      mimeType: "audio/mpeg",
      durationSec: words[words.length - 1].endSec,
      words,
      providerName: this.name,
    };
  }
}
