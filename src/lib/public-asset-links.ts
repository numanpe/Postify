import "server-only";
import crypto from "node:crypto";

import { db } from "@/lib/db";

// Just long enough for Meta's servers to fetch the image during one
// publish attempt (container creation, possibly retried), short enough
// that a leaked URL stops working quickly.
const TTL_MS = 10 * 60 * 1000;

function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error(
      "APP_URL is not set. Publishing to Instagram requires a publicly reachable HTTPS URL so Meta's servers can fetch the image — see .env.example.",
    );
  }
  return url.replace(/\/$/, "");
}

// Mints a short-lived, unguessable public URL for exactly one MediaAsset.
// Only call this immediately before a publish attempt that needs it (the
// Instagram adapter, Postproxy, Buffer) — see PublicAssetLink in
// prisma/schema.prisma for why this narrow, deliberate exception to the
// app's normal authenticated storage route exists. Served by
// src/app/api/storage/[...key]/route.ts's "public" branch (folded in
// from a formerly separate /api/public-assets/[token] route to reduce
// this deployment's Vercel Function count) — the /api/storage/public/
// prefix here must match that route's branch check exactly.
export async function createPublicAssetLink(mediaAssetId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db.publicAssetLink.create({
    data: { mediaAssetId, token, expiresAt },
  });

  return `${getAppUrl()}/api/storage/public/${token}`;
}

// Called once a publish attempt using the link is done (success or
// failure) so the window of public exposure is as short as possible —
// don't wait for the TTL if the caller already knows it's no longer
// needed.
export async function revokePublicAssetLinksForAsset(mediaAssetId: string): Promise<void> {
  await db.publicAssetLink.deleteMany({ where: { mediaAssetId } });
}

// Best-effort sweep for links whose TTL lapsed without an explicit
// revoke (e.g. the process crashed mid-publish). Cheap to call
// opportunistically — volume here is one row per publish attempt.
export async function pruneExpiredPublicAssetLinks(): Promise<void> {
  await db.publicAssetLink.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
