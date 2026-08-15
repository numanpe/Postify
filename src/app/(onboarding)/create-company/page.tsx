import { redirect } from "next/navigation";

import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { CreateCompanyForm } from "@/components/onboarding/create-company-form";

export default async function CreateCompanyPage() {
  const user = await requireUser();

  const existingMembership = await db.companyMember.findFirst({
    where: { userId: user.id },
  });
  if (existingMembership) {
    redirect("/media");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">Set up your company</h1>
        <p className="text-neutral-500">This takes about a minute.</p>
      </div>
      <CreateCompanyForm />
    </main>
  );
}
