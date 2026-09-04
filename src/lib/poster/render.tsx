import "server-only";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { AspectRatio, PosterTemplate } from "@prisma/client";

import { POSTER_DIMENSIONS } from "./dimensions";
import { detectDirection, type TextDirection } from "./direction";
import { getBundledFonts } from "@/lib/fonts";
import { POSTER_TEMPLATES } from "./templates";

export interface RenderPosterInput {
  headline: string;
  subhead?: string | null;
  cta?: string | null;
  aspectRatio: AspectRatio;
  template: PosterTemplate;
  backgroundBuffer: Buffer;
  backgroundMimeType: string;
  logoBuffer?: Buffer | null;
  logoMimeType?: string | null;
  // Data URI already, not a raw buffer — see qrcode.ts's own generator,
  // which produces one directly (no separate mimeType needed the way
  // logo/background buffers do, since it's always a fixed PNG).
  qrCodeDataUri?: string | null;
  brandColors: {
    primary?: string | null;
    secondary?: string | null;
    accent?: string | null;
  };
  // INFOGRAPHIC_SHOWCASE only — see templates.tsx's own doc comment on
  // that template for why these are optional here rather than required
  // across every template.
  companyName?: string;
  benefits?: { headline: string; subtext: string }[];
  trustBadges?: string[];
  contact?: { phone: string | null; whatsapp: string | null; email: string | null; website: string | null };
}

export interface RenderPosterOutput {
  png: Buffer;
  width: number;
  height: number;
  direction: TextDirection;
}

function toDataUri(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

// Dispatches to one of the 4 registered designs in templates.tsx. RTL is
// driven by the headline's actual script, not a stored company locale —
// see direction.ts. Each template's JSX tree and its quality-gate
// contrast guarantee (templates.tsx's contrastSpec) must describe the
// exact same rendered output — that pairing is what makes the gate real
// rather than decorative.
export async function renderPoster(input: RenderPosterInput): Promise<RenderPosterOutput> {
  const { width, height } = POSTER_DIMENSIONS[input.aspectRatio];
  const direction = detectDirection(input.headline);
  const fonts = await getBundledFonts();

  const backgroundDataUri = toDataUri(input.backgroundBuffer, input.backgroundMimeType);
  const logoDataUri = input.logoBuffer
    ? toDataUri(input.logoBuffer, input.logoMimeType ?? "image/png")
    : null;
  const fontFamily = direction === "rtl" ? "Tajawal" : "Lato";
  const textAlign = direction === "rtl" ? "right" : "left";

  const definition = POSTER_TEMPLATES[input.template];

  const tree = definition.render({
    headline: input.headline,
    subhead: input.subhead,
    cta: input.cta,
    direction,
    fontFamily,
    textAlign,
    width,
    height,
    backgroundDataUri,
    logoDataUri,
    qrCodeDataUri: input.qrCodeDataUri ?? null,
    brandColors: input.brandColors,
    companyName: input.companyName ?? "",
    benefits: input.benefits,
    trustBadges: input.trustBadges,
    contact: input.contact,
  });

  const svg = await satori(tree, {
    width,
    height,
    fonts: [
      { name: "Lato", data: fonts.latinRegular, weight: 400, style: "normal" },
      { name: "Lato", data: fonts.latinBold, weight: 700, style: "normal" },
      { name: "Tajawal", data: fonts.arabicRegular, weight: 400, style: "normal" },
      { name: "Tajawal", data: fonts.arabicBold, weight: 700, style: "normal" },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  const png = resvg.render().asPng();

  return { png: Buffer.from(png), width, height, direction };
}
