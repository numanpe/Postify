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

// Part 4's real "link in bio" page (src/app/bio/[slug]) needs its
// featured images to keep working indefinitely for anyone who visits
// the shared link — a different real need from the 10-minute
// Instagram-fetch window above, so this is a separate function (same
// PublicAssetLink table, same servePublicAsset route branch, no schema
// change) rather than parameterizing the narrow, security-reviewed
// publish-time function above. 180 days, reused (not re-minted) while
// still valid — src/lib/public-bio.ts calls this on every real page
// view, so re-minting unconditionally would leave stale rows behind on
// every single visit.
const BIO_LINK_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const BIO_LINK_REFRESH_BUFFER_MS = 30 * 24 * 60 * 60 * 1000; // re-mint once under 30 days left

export async function getOrCreateLongLivedPublicAssetLink(mediaAssetId: string): Promise<string> {
  const existing = await db.publicAssetLink.findFirst({
    where: { mediaAssetId, expiresAt: { gt: new Date(Date.now() + BIO_LINK_REFRESH_BUFFER_MS) } },
    orderBy: { expiresAt: "desc" },
  });
  if (existing) {
    return `${getAppUrl()}/api/storage/public/${existing.token}`;
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + BIO_LINK_TTL_MS);
  await db.publicAssetLink.create({ data: { mediaAssetId, token, expiresAt } });
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
