import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// Not routed through requireUser()/redirect() here — next/navigation's
// redirect() throws NEXT_REDIRECT, which Route Handlers don't unwind into
// an HTTP redirect the way pages/Server Actions do. Auth failures here
// return plain status codes instead.
//
// Folded in from the former /api/public-assets/[token]/route.ts to
// reduce this deployment's Vercel Function count (Hobby plan's real,
// empirically-confirmed 12-function cap). The "public" branch below is
// checked FIRST, before any auth/session logic runs, and is a complete,
// self-contained handler — it never touches the authenticated branch's
// code path or vice versa. This is still the same deliberately narrow,
// unauthenticated exception documented in PublicAssetLink
// (prisma/schema.prisma): do not extend this pattern to any other read
// path by copying the "public" branch elsewhere.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;

  if (key[0] === "public") {
    return servePublicAsset(key[1]);
  }

  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const storageKey = key.join("/");

  const asset = await db.mediaAsset.findUnique({ where: { storageKey } });
  if (!asset) {
    return new NextResponse(null, { status: 404 });
  }

  // Data-layer isolation check: the requester must actually belong to the
  // company that owns this asset, not just be logged in.
  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id, companyId: asset.companyId },
  });
  if (!membership) {
    return new NextResponse(null, { status: 403 });
  }

  const data = await storage.get(storageKey);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// Deliberately unauthenticated — see PublicAssetLink in
// prisma/schema.prisma. Serves only the one asset a token was minted
// for, only until expiresAt (10 minutes, see src/lib/public-asset-links.ts),
// and only exists at all because Instagram's Graph API media-container
// endpoint (and equivalent aggregator publish flows) require a
// publicly-fetchable URL.
async function servePublicAsset(token: string | undefined): Promise<NextResponse> {
  if (!token) {
    return new NextResponse(null, { status: 404 });
  }

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
