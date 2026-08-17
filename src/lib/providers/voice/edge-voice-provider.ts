import "server-only";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

import type { VoiceProvider, GenerateNarrationInput, GenerateNarrationOutput, WordTimestamp } from "./types";
import { VoiceProviderError } from "./types";
import { isArabicScript } from "@/lib/poster/direction";
import { withScratchDir, writeScratchFile } from "@/lib/video/scratch";
import { probeMedia } from "@/lib/video/ffmpeg";

// en-US and ar-AE neural voices — chosen by script detection on the
// text itself (same isArabicScript check posters/videos already use),
// not stored company locale. UAE-specific Arabic voice since that's
// this app's primary Arabic market.
const EN_VOICE = "en-US-AriaNeural";
const AR_VOICE = "ar-AE-FatimaNeural";

interface RawWordBoundary {
  Metadata: { Type: string; Data: { Offset: number; Duration: number; text: { Text: string } } }[];
}

// Microsoft's Edge "Read Aloud" WebSocket endpoint — free, no API key,
// but unofficial and reverse-engineered (not a documented/supported
// Microsoft API). The msedge-tts package tracks Microsoft's occasional
// protocol/auth changes; if this starts failing consistently, callers
// should point users at the BYOK path (OpenAI/ElevenLabs) rather than
// treat it as a code bug first. See Settings' voice engine toggle.
export class EdgeVoiceProvider implements VoiceProvider {
  readonly name = "Edge TTS (free, community engine)";

  async generateNarration({ text }: GenerateNarrationInput): Promise<GenerateNarrationOutput> {
    const voice = isArabicScript(text) ? AR_VOICE : EN_VOICE;

    const tts = new MsEdgeTTS();
    let audioBuffer: Buffer;
    let words: WordTimestamp[];
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
        wordBoundaryEnabled: true,
      });
      const { audioStream, metadataStream } = tts.toStream(text);

      const audioChunks: Buffer[] = [];
      audioStream.on("data", (chunk: Buffer) => audioChunks.push(chunk));

      const boundaries: RawWordBoundary[] = [];
      metadataStream?.on("data", (chunk: Buffer) => {
        try {
          boundaries.push(JSON.parse(chunk.toString()) as RawWordBoundary);
        } catch {
          // Non-JSON metadata frames (sentence markers, etc.) are
          // ignored — only WordBoundary entries matter for captions.
        }
      });

      await new Promise<void>((resolve, reject) => {
        audioStream.on("end", resolve);
        audioStream.on("error", reject);
      });

      audioBuffer = Buffer.concat(audioChunks);
      if (audioBuffer.byteLength === 0) {
        throw new Error("Received no audio data.");
      }

      // Offset/Duration are in 100-nanosecond ticks — divide by 1e7 for
      // seconds. Real per-word timing from the synthesis stream itself,
      // not a separate transcription pass (unlike the OpenAI provider,
      // which has to transcribe its own output to recover word timing).
      words = boundaries
        .flatMap((event) => event.Metadata)
        .filter((entry) => entry.Type === "WordBoundary")
        .map((entry) => ({
          word: entry.Data.text.Text,
          startSec: entry.Data.Offset / 1e7,
          endSec: (entry.Data.Offset + entry.Data.Duration) / 1e7,
        }));
    } catch (error) {
      throw new VoiceProviderError(
        this.name,
        "The free voice engine didn't respond. This is a community-maintained service and can be less reliable than a paid provider — try again, or add an OpenAI/ElevenLabs key in Settings.",
        error,
      );
    } finally {
      tts.close();
    }

    if (words.length === 0) {
      throw new VoiceProviderError(this.name, "The free voice engine returned no narration timing for this script.");
    }

    // Real audio duration (not just the last word's end time — there's
    // trailing silence/padding after it) via the same ffprobe already
    // used for video assets.
    const durationSec = await withScratchDir(async (dir) => {
      const filePath = await writeScratchFile(dir, "narration.mp3", audioBuffer);
      const probe = await probeMedia(filePath);
      return probe.durationSec;
    });

    return {
      audioBuffer,
      mimeType: "audio/mpeg",
      durationSec: durationSec || words[words.length - 1].endSec,
      words,
      providerName: this.name,
    };
  }
}
