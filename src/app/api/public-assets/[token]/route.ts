import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// Deliberately unauthenticated — see PublicAssetLink in
// prisma/schema.prisma. Serves only the one asset a token was minted
// for, only until expiresAt (10 minutes, see src/lib/public-asset-links.ts),
// and only exists at all because Instagram's Graph API media-container
// endpoint requires a publicly-fetchable image_url. Do not add any other
// unauthenticated read path to this app by copying this route.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const link = await db.publicAssetLink.findUnique({
    where: { token },
    include: { mediaAsset: true },
  });

  if (!link || link.expiresAt < new Date()) {
    return new NextResponse(null, { status: 404 });
  }

  const data = await storage.get(link.mediaAsset.storageKey);

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": link.mediaAsset.mimeType,
      "Cache-Control": "no-store",
    },
  });
}
