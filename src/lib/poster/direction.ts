// Arabic script Unicode block ranges (Arabic, Arabic Supplement, Arabic
// Extended-A, Arabic Presentation Forms A/B), expressed as numeric
// codepoints rather than a regex literal — avoids any ambiguity between
// visually similar characters in source. Direction is detected from
// the actual headline text rather than trusting Company.locale — more
// robust, and it means a company can produce both an English and an
// Arabic poster without a per-poster locale toggle.
const ARABIC_CODEPOINT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0600, 0x06ff], // Arabic
  [0x0750, 0x077f], // Arabic Supplement
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0xfb50, 0xfdff], // Arabic Presentation Forms-A
  [0xfe70, 0xfeff], // Arabic Presentation Forms-B
];

export type TextDirection = "ltr" | "rtl";

export function isArabicScript(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (ARABIC_CODEPOINT_RANGES.some(([start, end]) => code >= start && code <= end)) {
      return true;
    }
  }
  return false;
}

export function detectDirection(text: string): TextDirection {
  return isArabicScript(text) ? "rtl" : "ltr";
}
