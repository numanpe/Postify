import "server-only";
import sharp from "sharp";
import smartcrop from "smartcrop-sharp";

// Real, established content-aware cropping (smartcrop.js's saliency
// algorithm — edge/contrast/skin-tone scoring, not a fake "AI subject
// detection" claim CLAUDE.md's no-fake-functionality rule would forbid).
// smartcrop-sharp (not raw smartcrop.js) specifically because it reuses
// the sharp binary this app already depends on instead of pulling in
// node-canvas — one fewer native dependency to keep working across
// local dev and Vercel's serverless runtime.
//
// Applied only to real uploaded photos (BackgroundSource.PHOTO in
// generate.ts) — BRAND gradients and AI-generated backgrounds are
// already composed at the target dimensions and have no "subject" to
// re-frame.
export async function smartCropToAspect(
  buffer: Buffer,
  targetWidth: number,
  targetHeight: number,
): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    // Can't compute a crop without real dimensions — fall back to a
    // plain center-cover resize rather than throwing, since the poster
    // pipeline's own object-fit: cover already does this safely.
    return sharp(buffer).resize(targetWidth, targetHeight, { fit: "cover" }).toBuffer();
  }

  // smartcrop needs the crop window's aspect ratio, not literal target
  // pixel dimensions — using the real target ratio scaled to the source
  // image's resolution keeps its saliency scoring working at native
  // detail instead of upscaling artifacts skewing the result.
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = metadata.width / metadata.height;
  const cropWidth = sourceRatio > targetRatio ? Math.round(metadata.height * targetRatio) : metadata.width;
  const cropHeight = sourceRatio > targetRatio ? metadata.height : Math.round(metadata.width / targetRatio);

  const result = await smartcrop.crop(buffer, { width: cropWidth, height: cropHeight });
  const { x, y, width, height } = result.topCrop;

  return sharp(buffer)
    .extract({
      left: Math.max(0, Math.round(x)),
      top: Math.max(0, Math.round(y)),
      width: Math.round(width),
      height: Math.round(height),
    })
    .resize(targetWidth, targetHeight, { fit: "cover" })
    .toBuffer();
}
