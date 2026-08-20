import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import {
  buildAuthorizeUrl,
  exchangeCodeForUserToken,
  exchangeForLongLivedUserToken,
  listConnectedPages,
} from "@/lib/providers/social/meta-oauth";

const STATE_COOKIE = "meta_oauth_state";

// Page access tokens derived from a long-lived (~60 day) user token carry
// no separate expiry of their own — Postify treats them as valid for the
// same 60-day window and prompts a reconnect after, same as the user
// token they came from.
const TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function redirectToPublish(request: Request, status: "connected" | "error", detail?: string) {
  const dest = new URL("/publish", request.url);
  dest.searchParams.set("meta", status);
  if (detail) dest.searchParams.set("detail", detail);
  const response = NextResponse.redirect(dest);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

// Both the connect (initiate) and callback legs of the Meta OAuth flow
// live in this one file now — folded from two separate route.ts files
// to reduce this deployment's Vercel Function count (Hobby plan caps a
// deployment at 12; see the real deploy failure this fixed). This path
// (/api/social/meta/callback) is the exact redirect_uri already
// registered with the real Meta Developer app
// (meta-oauth.ts's getRedirectUri()) — that URL can't move, so the
// initiate leg was folded INTO it rather than the other way around.
// Distinguished by whether Meta's own `code` param is present: no code
// means "start a new connection", a code means "Meta is calling back
// with a real authorization result."
//
// Not routed through requireCompany()/redirect() — next/navigation's
// redirect() doesn't unwind into an HTTP redirect from a Route Handler
// the way it does from pages/Server Actions (see the same note in
// src/app/api/storage/[...key]/route.ts). Auth failures redirect via a
// plain NextResponse instead.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
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
  const oauthError =
    url.searchParams.get("error_message") ?? url.searchParams.get("error_description");
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
    const shortLivedToken = await exchangeCodeForUserToken(code);
    const userToken = await exchangeForLongLivedUserToken(shortLivedToken);
    const pages = await listConnectedPages(userToken);

    if (pages.length === 0) {
      return redirectToPublish(
        request,
        "error",
        "No Facebook Pages found. You must be an admin of at least one Page to connect it.",
      );
    }

    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    for (const page of pages) {
      const encryptedToken = encryptSecret(page.pageAccessToken);

      await db.socialAccount.upsert({
        where: {
          companyId_platform_externalAccountId: {
            companyId: membership.companyId,
            platform: "FACEBOOK",
            externalAccountId: page.pageId,
          },
        },
        create: {
          companyId: membership.companyId,
          platform: "FACEBOOK",
          externalAccountId: page.pageId,
          displayName: page.pageName,
          encryptedToken,
          tokenExpiresAt,
        },
        update: { displayName: page.pageName, encryptedToken, tokenExpiresAt },
      });

      if (page.instagramAccountId) {
        const displayName = page.instagramUsername
          ? `@${page.instagramUsername}`
          : `${page.pageName} (Instagram)`;

        await db.socialAccount.upsert({
          where: {
            companyId_platform_externalAccountId: {
              companyId: membership.companyId,
              platform: "INSTAGRAM",
              externalAccountId: page.instagramAccountId,
            },
          },
          create: {
            companyId: membership.companyId,
            platform: "INSTAGRAM",
            externalAccountId: page.instagramAccountId,
            displayName,
            encryptedToken,
            tokenExpiresAt,
          },
          update: { displayName, encryptedToken, tokenExpiresAt },
        });
      }
    }

    return redirectToPublish(request, "connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed.";
    return redirectToPublish(request, "error", message);
  }
}

// Formerly src/app/api/social/meta/connect/route.ts — unchanged logic,
// just no longer a separate route.
function startConnect(request: Request): NextResponse {
  const state = randomBytes(24).toString("base64url");
  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta is not configured.";
    const dest = new URL("/publish", request.url);
    dest.searchParams.set("meta", "error");
    dest.searchParams.set("detail", message);
    return NextResponse.redirect(dest);
  }

  const response = NextResponse.redirect(authorizeUrl);
  // CSRF protection for the callback: the state Meta echoes back must
  // match this cookie, tying the callback to the browser session that
  // actually started the connect flow.
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/social/meta",
  });
  return response;
}
