import { requireCompany } from "@/lib/session";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { company } = await requireCompany();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-paper-border dark:border-night-border px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Postify</span>
          <span className="text-sm text-ink-soft dark:text-ink-soft-dark">{company.name}</span>
        </div>
        <AppNav />
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
