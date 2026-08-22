import { requireCompany } from "@/lib/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";

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
  const { company } = await requireCompany();
  const locale = await getLocale();

  return (
    <LocaleProvider locale={locale}>
      <div className="flex min-h-dvh flex-col">
        <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-paper-border dark:border-night-border px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Postify</span>
            <span className="text-sm text-ink-soft dark:text-ink-soft-dark">{company.name}</span>
          </div>
          <AppNav />
        </header>
        {/* pb-24 clears BottomNav's fixed height + its own safe-area
            padding below md:; md:pb-6 restores the normal desktop value
            since BottomNav doesn't render there at all. */}
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-6">{children}</main>
        <BottomNav />
      </div>
    </LocaleProvider>
  );
}
