import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolveActiveMembership } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import {
  ensureZernioProfile,
  startHeadlessConnect,
  ZernioConnectError,
  isZernioPlatformSlug,
  type ZernioPlatformSlug,
} from "@/lib/providers/aggregator/zernio-connect";

const CTX_COOKIE = "zernio_connect_ctx";

function isZernioPlatform(value: string | null): value is ZernioPlatformSlug {
  return !!value && isZernioPlatformSlug(value);
}

function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error("APP_URL is not set — required for the Zernio embedded connect flow.");
  }
  return url.replace(/\/$/, "");
}

function redirectToSettings(request: Request, params: Record<string, string>) {
  const dest = new URL("/settings", request.url);
  for (const [key, value] of Object.entries(params)) dest.searchParams.set(key, value);
  const response = NextResponse.redirect(dest);
  response.cookies.delete(CTX_COOKIE);
  return response;
}

// Both legs of Zernio's embedded (headless) connect flow live in this
// one route — same fold-initiate-and-callback-together pattern as
// src/app/api/social/meta/callback/route.ts, for the same real reason
// (Vercel Hobby's 12-function cap; see that file's own comment). Unlike
// Meta's OAuth, Zernio's own redirect_url is passed per-request (not a
// fixed pre-registered URL — see zernio-connect.ts), so both legs
// pointing at this same path is a deliberate choice, not a constraint.
// Distinguished by whether Zernio's own tempToken is present: no token
// means "start a new connection", a token means "Zernio is calling back
// after the user completed real OAuth with the platform."
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  const membership = await resolveActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.redirect(new URL("/create-company", request.url));
  }

  const url = new URL(request.url);
  const tempToken = url.searchParams.get("tempToken");

  if (!tempToken) {
    return startConnect(request, membership.companyId);
  }
  return handleCallback(request, membership.companyId);
}

async function startConnect(request: Request, companyId: string): Promise<NextResponse> {
  const url = new URL(request.url);
  const credentialId = url.searchParams.get("credentialId");
  const platform = url.searchParams.get("platform");

  if (!credentialId || !isZernioPlatform(platform)) {
    return redirectToSettings(request, { zernio: "error", detail: "Missing or invalid connect request." });
  }

  // Multi-tenant isolation: scope by companyId, never trust the
  // client-supplied credentialId alone — same rule every other
  // aggregator mutation in this app already follows.
  const credential = await db.aggregatorCredential.findFirst({
    where: { id: credentialId, companyId, provider: "ZERNIO" },
  });
  if (!credential) {
    return redirectToSettings(request, { zernio: "error", detail: "Add your Zernio API key first." });
  }

  try {
    const apiKey = decryptSecret(credential.encryptedKey);
    const profileId = await ensureZernioProfile(credential.id, apiKey);
    const { authUrl } = await startHeadlessConnect(
      apiKey,
      platform,
      profileId,
      `${getAppUrl()}/api/aggregator/zernio/connect`,
    );

    const response = NextResponse.redirect(authUrl);
    // Real (if adapted) CSRF protection: Zernio's own callback doesn't
    // echo back a state value we control (unlike Meta's `state` param —
    // see meta/callback's own comment), only its own tempToken/
    // connect_token. This cookie ties the eventual callback to the
    // browser session that actually started it instead: the callback is
    // only trusted if this exact cookie is present and its platform
    // matches what Zernio reports back.
    response.cookies.set(
      CTX_COOKIE,
      JSON.stringify({ credentialId, platform, companyId }),
      { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/aggregator/zernio" },
    );
    return response;
  } catch (error) {
    const message = error instanceof ZernioConnectError || error instanceof Error ? error.message : "Connection failed.";
    return redirectToSettings(request, { zernio: "error", detail: message });
  }
}

async function handleCallback(request: Request, companyId: string): Promise<NextResponse> {
  const url = new URL(request.url);
  const tempToken = url.searchParams.get("tempToken")!;
  const platform = url.searchParams.get("platform");
  const userProfile = url.searchParams.get("userProfile");
  const profileIdParam = url.searchParams.get("profileId");

  const rawCtx = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((pair) => pair.startsWith(`${CTX_COOKIE}=`))
    ?.slice(CTX_COOKIE.length + 1);

  let ctx: { credentialId: string; platform: string; companyId: string } | null = null;
  try {
    ctx = rawCtx ? JSON.parse(decodeURIComponent(rawCtx)) : null;
  } catch {
    ctx = null;
  }

  if (!ctx || ctx.companyId !== companyId || ctx.platform !== platform || !isZernioPlatform(platform)) {
    return redirectToSettings(request, {
      zernio: "error",
      detail: "The connection request expired or was invalid. Please try again.",
    });
  }
  if (!userProfile || !profileIdParam) {
    return redirectToSettings(request, { zernio: "error", detail: "Zernio didn't return the expected connection data." });
  }

  // Hands the real, still-valid tempToken/userProfile/profileId forward
  // to a real Settings page section, which fetches the actual list of
  // selectable pages and renders the picker — see the Settings page's
  // own handling of these params. This route's job ends at "the OAuth
  // round-trip with the platform succeeded," not the page selection.
  const dest = new URL("/settings", request.url);
  dest.searchParams.set("zernioConnect", "1");
  dest.searchParams.set("credentialId", ctx.credentialId);
  dest.searchParams.set("platform", platform);
  dest.searchParams.set("profileId", profileIdParam);
  dest.searchParams.set("tempToken", tempToken);
  dest.searchParams.set("userProfile", userProfile);
  const response = NextResponse.redirect(dest);
  response.cookies.delete(CTX_COOKIE);
  return response;
}
