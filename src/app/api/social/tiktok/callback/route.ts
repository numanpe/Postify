import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { buildAuthorizeUrl, exchangeCodeForToken, getAccountInfo } from "@/lib/providers/social/tiktok-oauth";

const STATE_COOKIE = "tiktok_oauth_state";

function redirectToPublish(request: Request, status: "connected" | "error", detail?: string) {
  const dest = new URL("/publish", request.url);
  dest.searchParams.set("tiktok", status);
  if (detail) dest.searchParams.set("detail", detail);
  const response = NextResponse.redirect(dest);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

// Connect (initiate) and callback folded into one route, matching
// src/app/api/social/meta/callback/route.ts's exact pattern. Unlike
// Meta/LinkedIn there's only ever one account per authenticating TikTok
// user (no page/org list step) — a single upsert, not a loop.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const membership = await db.companyMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) {
    return NextResponse.redirect(new URL("/create-company", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return startConnect(request);
  }

  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const expectedState = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((pair) => pair.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);

  if (oauthError) {
    return redirectToPublish(request, "error", oauthError);
  }
  if (!state || !expectedState || state !== expectedState) {
    return redirectToPublish(
      request,
      "error",
      "The connection request expired or was invalid. Please try again.",
    );
  }

  try {
    const { accessToken, openId, expiresInSec } = await exchangeCodeForToken(code);
    const account = await getAccountInfo(accessToken);

    const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000);
    const encryptedToken = encryptSecret(accessToken);

    await db.socialAccount.upsert({
      where: {
        companyId_platform_externalAccountId: {
          companyId: membership.companyId,
          platform: "TIKTOK",
          externalAccountId: openId,
        },
      },
      create: {
        companyId: membership.companyId,
        platform: "TIKTOK",
        externalAccountId: openId,
        displayName: account.displayName,
        encryptedToken,
        tokenExpiresAt,
      },
      update: { displayName: account.displayName, encryptedToken, tokenExpiresAt },
    });

    return redirectToPublish(request, "connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed.";
    return redirectToPublish(request, "error", message);
  }
}

function startConnect(request: Request): NextResponse {
  const state = randomBytes(24).toString("base64url");
  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok is not configured.";
    const dest = new URL("/publish", request.url);
    dest.searchParams.set("tiktok", "error");
    dest.searchParams.set("detail", message);
    return NextResponse.redirect(dest);
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/social/tiktok",
  });
  return response;
}
