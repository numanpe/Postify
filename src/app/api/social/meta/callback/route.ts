import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import {
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

// See the same note in ../connect/route.ts about not using
// requireCompany()/redirect() inside a Route Handler.
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
  if (!code || !state || !expectedState || state !== expectedState) {
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
