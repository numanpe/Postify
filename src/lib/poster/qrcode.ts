import "server-only";
import QRCode from "qrcode";

// Pure-JS PNG encoding (qrcode bundles pngjs — no native canvas
// dependency), same "works everywhere Node runs, zero extra install
// step" bar as the rest of this app's free-tier pipeline. Rendered at a
// fixed real pixel size rather than derived from the poster's own
// width/height — satori scales the <img> down to whatever slot each
// template gives it (see templates.tsx's QR_BADGE_SIZE_FRACTION), and a
// QR code's own real scan reliability depends on its source resolution
// staying sharp, not on matching the canvas 1:1.
const QR_SOURCE_PX = 512;

export async function generateQrCodeDataUri(targetUrl: string): Promise<string> {
  const buffer = await QRCode.toBuffer(targetUrl, {
    type: "png",
    width: QR_SOURCE_PX,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
