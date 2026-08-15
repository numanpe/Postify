import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { signOut } from "@/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { company } = await requireCompany();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Postify</span>
          <span className="text-sm text-neutral-500">{company.name}</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/studio" className="font-medium text-neutral-700 hover:text-neutral-900">
            Content Studio
          </Link>
          <Link href="/poster" className="font-medium text-neutral-700 hover:text-neutral-900">
            Poster Studio
          </Link>
          <Link href="/video" className="font-medium text-neutral-700 hover:text-neutral-900">
            Video Studio
          </Link>
          <Link href="/campaigns" className="font-medium text-neutral-700 hover:text-neutral-900">
            Campaigns
          </Link>
          <Link href="/media" className="font-medium text-neutral-700 hover:text-neutral-900">
            Media Library
          </Link>
          <Link href="/brand-kit" className="font-medium text-neutral-700 hover:text-neutral-900">
            Brand Kit
          </Link>
          <Link href="/settings" className="font-medium text-neutral-700 hover:text-neutral-900">
            Settings
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-neutral-500 hover:text-neutral-900">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
