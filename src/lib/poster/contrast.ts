// WCAG 2.x relative luminance + contrast ratio — a real implementation
// of the standard formula, not an approximation. Used both to pick a
// readable CTA badge text color at render time and by the quality gate
// to verify headline/subhead contrast after rendering.

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function channelLuminance(channel8Bit: number): number {
  const s = channel8Bit / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexA);
  const luminanceB = relativeLuminance(hexB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(backgroundHex: string): "#ffffff" | "#000000" {
  const whiteContrast = contrastRatio(backgroundHex, "#ffffff");
  const blackContrast = contrastRatio(backgroundHex, "#000000");
  return whiteContrast >= blackContrast ? "#ffffff" : "#000000";
}
