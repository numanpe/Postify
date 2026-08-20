import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login");
  }

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });

  redirect(membership ? "/media" : "/create-company");
}
