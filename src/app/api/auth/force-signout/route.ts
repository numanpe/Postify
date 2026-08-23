import type { NextRequest } from "next/server";

import { signOut } from "@/auth";

// Exists because requireUser()/requireCompany() (src/lib/session.ts)
// detect a banned/suspended status during a Server Component render,
// where cookies can't be cleared — a plain redirect() there left the
// session cookie intact, which (auth)/layout.tsx's own "already
// authenticated? bounce away from /auth/login back to /" check then
// immediately reverted, producing a genuine infinite redirect loop
// (caught by tests/admin-panel.spec.ts, not by inspection). A Route
// Handler can set the Set-Cookie header signOut() needs, so the loop
// only breaks once the session is actually gone, not just redirected
// around.
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const target = status ? `/auth/login?status=${encodeURIComponent(status)}` : "/auth/login";
  await signOut({ redirectTo: target });
}
