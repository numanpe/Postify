import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { CompanySwitcher } from "@/components/company-switcher";

// The one place LocaleProvider renders — see the root layout's doc
// comment for why it moved here instead of wrapping every route.
// getLocale() is React cache()-wrapped, so this is a second call, not a
// second DB round trip; the root layout's own call already populated
// the per-request cache.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, company } = await requireCompany();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  // Cheap on top of requireCompany()'s own membership lookup (id/name
  // only, no include) — only used to decide whether a switcher is worth
  // showing at all. Most users have exactly one company; the plain
  // company-name label below stays the only thing rendered for them.
  const memberships = await db.companyMember.findMany({
    where: { userId: user.id },
    select: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <LocaleProvider locale={locale}>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-paper dark:focus:bg-primary-dark dark:focus:text-night"
        >
          {dict.common.skipToContent}
        </a>
        <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-paper-border dark:border-night-border px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Postify</span>
            {memberships.length > 1 ? (
              <CompanySwitcher companies={memberships.map((m) => m.company)} activeCompanyId={company.id} />
            ) : (
              <span className="text-sm text-ink-soft dark:text-ink-soft-dark">{company.name}</span>
            )}
          </div>
          <AppNav />
        </header>
        {/* pb-24 clears BottomNav's fixed height + its own safe-area
            padding below md:; md:pb-6 restores the normal desktop value
            since BottomNav doesn't render there at all. */}
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </LocaleProvider>
  );
}
