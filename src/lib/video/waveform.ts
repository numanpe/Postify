// Builds the ffmpeg filter_complex fragment for a real, audio-reactive
// waveform band — genuine signal-driven pixels via ffmpeg's native
// showwaves filter, not a decorative animation. Kept as pure string-
// building (no ffmpeg execution here) so render.ts can splice it into
// its single big composite filter graph instead of round-tripping
// through an intermediate file, which would lose the alpha channel
// (h264/yuv420p MP4 has no alpha channel to carry a translucent band
// back out again).
export interface WaveformBandFilterInput {
  audioInputLabel: string; // e.g. "2:a" — the ffmpeg input index carrying the mixed audio
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  outputLabel: string; // e.g. "wave" -> produces [wave]
}

export function buildWaveformBandFilter(input: WaveformBandFilterInput): string {
  const { audioInputLabel, width, height, durationSec, fps, outputLabel } = input;
  return [
    // Translucent dark bar so the waveform reads clearly over any
    // footage behind it — same rgba(0,0,0,~0.7) treatment as the
    // caption pill, for visual consistency across overlay types.
    `color=c=black@0.45:s=${width}x${height}:d=${durationSec.toFixed(3)}[${outputLabel}bg]`,
    // showwaves draws on black; colorkey (an RGB-space filter, hence
    // the explicit format=rgba first) punches the black back out to
    // alpha so only the wave lines themselves composite over the bar.
    `[${audioInputLabel}]showwaves=s=${width}x${height}:mode=cline:colors=white:rate=${fps},format=rgba,colorkey=0x000000:0.2:0.1[${outputLabel}raw]`,
    `[${outputLabel}bg][${outputLabel}raw]overlay[${outputLabel}]`,
  ].join(";");
}
