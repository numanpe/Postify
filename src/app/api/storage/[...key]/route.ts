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

  // Real bug found live (2026-09-07): scene thumbnails (captureSceneThumbnail,
  // src/lib/video/scene-thumbnails.ts) are the one place in the app that
  // calls storage.put() directly without ever creating a matching
  // MediaAsset row — every other writer (uploads, posters, videos, video
  // edits) does. The lookup below has required a MediaAsset row since
  // this route's very first version (Phase 1), so every AI_STILL/
  // REAL_VIDEO scene's thumbnail 404'd here, rendering as a blank box in
  // the scene editor strip — never caught because verification of that
  // feature happened to use REAL_PHOTO scenes (which reuse the real
  // uploaded photo's own MediaAsset row/storageKey directly, no separate
  // thumbnail file at all).
  //
  // Fixed by recognizing this one real, narrow key shape and checking
  // company membership straight from the companyId already embedded in
  // the key path (buildStorageKey's own {companyId}/{uuid}-{fileName}
  // shape) — the same real isolation guarantee the MediaAsset lookup
  // provides, just sourced from the path instead of a DB row. Chosen
  // over giving every thumbnail its own MediaAsset row: that would make
  // every derived thumbnail show up in the Media Library / every asset
  // picker unless EVERY one of those queries also learned to filter it
  // out — a real, easy-to-miss drift risk this file's own git history
  // already shows this app trying to avoid (see the "reduce Vercel
  // Function count" merge this route came from, and getPickableMediaAssets'
  // own consolidation). Scoped to this one recognizable filename pattern
  // on purpose — never a general bypass of the MediaAsset check below.
  if (key.length === 2 && /-scene-thumb-\d+\.jpg$/.test(key[1])) {
    return serveSceneThumbnail(key[0], storageKey, session.user.id);
  }

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

// See this function's call site above for the real bug this closes.
// storageKey's own companyId segment (key[0]) is the same real
// isolation boundary the MediaAsset-row lookup above enforces — a
// company can only ever see its own thumbnails, real membership
// checked the same way. Always a real JPEG (generateImageThumbnail/
// generateVideoThumbnail, scene-thumbnails.ts both encode .jpeg), so
// the content type is a real, correct constant here, not a guess.
async function serveSceneThumbnail(companyId: string, storageKey: string, userId: string): Promise<NextResponse> {
  const membership = await db.companyMember.findFirst({ where: { userId, companyId } });
  if (!membership) {
    return new NextResponse(null, { status: 403 });
  }

  try {
    const data = await storage.get(storageKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    // A re-render's own cleanup (scene-editor.ts's persistRender)
    // deletes a scene's old thumbnail file once its replacement is
    // saved — a real, honest 404 for a stale reference, not a fake
    // image or an unhandled 500.
    return new NextResponse(null, { status: 404 });
  }
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
