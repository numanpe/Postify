import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId");
  if (!assetId) {
    return Response.json({ error: "assetId query param required" }, { status: 400 });
  }
  const asset = await db.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const buffer = await storage.get(asset.storageKey);
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": asset.mimeType } });
}
