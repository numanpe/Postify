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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-border dark:border-night-border px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Postify</span>
          <span className="text-sm text-ink-soft dark:text-ink-soft-dark">{company.name}</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/studio" className="font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
            Content Studio
          </Link>
          <Link href="/poster" className="font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
            Poster Studio
          </Link>
          <Link href="/video" className="font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
            Video Studio
          </Link>
          <Link href="/campaigns" className="font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
            Campaigns
          </Link>
          <Link href="/publish" className="font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
            Publish
          </Link>
          <Link href="/media" className="font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
            Media Library
          </Link>
          <Link href="/brand-kit" className="font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
            Brand Kit
          </Link>
          <Link href="/settings" className="font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
            Settings
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
