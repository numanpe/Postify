import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    return <LandingPage />;
  }

  // Real bug found live (2026-09-06): this page used to read
  // session.user directly instead of going through requireUser() like
  // every other protected page does — skipping requireUser()'s real DB
  // check for a banned/suspended user's status (a JWT session cookie
  // stays cryptographically valid regardless of DB status) and its
  // force-signout redirect for that case. A non-ACTIVE user landing
  // here with a still-valid session cookie fell through to the
  // membership check below with a stale sense of "authenticated" that
  // every other page's requireUser()/requireCompany() call would have
  // caught — confirmed via real production logs as the cause of a
  // live `/` <-> `/create-company` <-> `/auth/login` redirect loop.
  const user = await requireUser();

  const membership = await db.companyMember.findFirst({
    where: { userId: user.id },
  });

  redirect(membership ? "/media" : "/create-company");
}
