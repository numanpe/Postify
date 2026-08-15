import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");

export interface PosterFonts {
  latinRegular: Buffer;
  latinBold: Buffer;
  arabicRegular: Buffer;
  arabicBold: Buffer;
}

let cached: PosterFonts | null = null;

function loadFont(fileName: string): Promise<Buffer> {
  return readFile(path.join(FONTS_DIR, fileName));
}

// Satori requires static TTF/OTF per weight (no variable-font
// interpolation, no WOFF2) — see assets/fonts/README.md for why Lato/
// Tajawal specifically.
export async function getPosterFonts(): Promise<PosterFonts> {
  if (cached) return cached;

  const [latinRegular, latinBold, arabicRegular, arabicBold] = await Promise.all([
    loadFont("Lato-Regular.ttf"),
    loadFont("Lato-Bold.ttf"),
    loadFont("Tajawal-Regular.ttf"),
    loadFont("Tajawal-Bold.ttf"),
  ]);

  cached = { latinRegular, latinBold, arabicRegular, arabicBold };
  return cached;
}
