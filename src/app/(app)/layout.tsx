import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { signOut } from "@/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale());

  const linkClass =
    "font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-border dark:border-night-border px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Postify</span>
          <span className="text-sm text-ink-soft dark:text-ink-soft-dark">{company.name}</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/studio" className={linkClass}>
            {dict.nav.studio}
          </Link>
          <Link href="/poster" className={linkClass}>
            {dict.nav.poster}
          </Link>
          <Link href="/video" className={linkClass}>
            {dict.nav.video}
          </Link>
          <Link href="/campaigns" className={linkClass}>
            {dict.nav.campaigns}
          </Link>
          <Link href="/publish" className={linkClass}>
            {dict.nav.publish}
          </Link>
          <Link href="/media" className={linkClass}>
            {dict.nav.media}
          </Link>
          <Link href="/brand-kit" className={linkClass}>
            {dict.nav.brandKit}
          </Link>
          <Link href="/settings" className={linkClass}>
            {dict.nav.settings}
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className={linkClass}>
              {dict.nav.signOut}
            </button>
          </form>
        </nav>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
