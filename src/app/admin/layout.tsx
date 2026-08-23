import Link from "next/link";

import { requireAdmin } from "@/lib/session";

// Deliberately its own top-level route, not nested under (app) — that
// layout calls requireCompany() unconditionally (src/app/(app)/layout.tsx),
// which would force every admin to also have a company membership. An
// admin's authority is platform-level and shouldn't depend on that.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminRole } = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-paper-border dark:border-night-border px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Postify Admin</span>
          <span className="text-sm text-ink-soft dark:text-ink-soft-dark">{adminRole.replace("_", " ")}</span>
        </div>
        <Link href="/" className="text-sm underline">
          Back to app
        </Link>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
