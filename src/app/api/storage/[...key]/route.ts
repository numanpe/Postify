import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// Not routed through requireUser()/redirect() here — next/navigation's
// redirect() throws NEXT_REDIRECT, which Route Handlers don't unwind into
// an HTTP redirect the way pages/Server Actions do. Auth failures here
// return plain status codes instead.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const { key } = await params;
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
