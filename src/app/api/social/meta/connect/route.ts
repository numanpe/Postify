import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildAuthorizeUrl } from "@/lib/providers/social/meta-oauth";

const STATE_COOKIE = "meta_oauth_state";

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
