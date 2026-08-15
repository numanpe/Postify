import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Postify</h1>
      {children}
    </main>
  );
}
