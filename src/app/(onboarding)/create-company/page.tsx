import { redirect } from "next/navigation";

import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { WebsiteFirstOnboarding } from "@/components/onboarding/website-first-onboarding";

export default async function CreateCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireUser();
  const { new: isAddingAnother } = await searchParams;

  const existingMembership = await db.companyMember.findFirst({
    where: { userId: user.id },
  });
  // Multi-company support: an existing member is normally bounced back to
  // /media (this page is onboarding, not something a returning user should
  // land on by accident) — except when they arrived via the real "Add
  // another company" entry point (?new=1), which explicitly wants this
  // exact flow to run again for a genuinely new company.
  if (existingMembership && !isAddingAnother) {
    redirect("/media");
  }

  return (
    // items-center + justify-start (not justify-center) — the website-
    // first review screen (Part B2) can grow much taller than the old
    // one-screen manual form once colors/fonts/description/tone are all
    // shown, and vertically centering a tall form pushes its top off
    // the initial viewport, unlike a short form where centering reads
    // fine either way.
    <main className="flex min-h-dvh flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">Set up your company</h1>
        <p className="text-ink-soft dark:text-ink-soft-dark">This takes about a minute.</p>
      </div>
      <WebsiteFirstOnboarding />
    </main>
  );
}
