import Link from "next/link";

// Plain Link-based pagination — no client state, no "use client": the
// current page lives entirely in the URL (?page=N), which is what
// makes this work correctly with the server-rendered pages it's used
// on (media/page.tsx, campaigns/page.tsx) without any extra plumbing.
export function PaginationNav({
  currentPage,
  totalPages,
  basePath,
  previousLabel,
  nextLabel,
  indicatorLabel,
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  previousLabel: string;
  nextLabel: string;
  indicatorLabel: string;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => (page <= 1 ? basePath : `${basePath}?page=${page}`);
  const linkClass =
    "rounded-md border border-paper-border px-3 py-1.5 font-medium text-ink hover:border-ink-soft dark:border-night-border dark:text-ink-dark dark:hover:border-ink-soft-dark";
  const disabledClass =
    "rounded-md border border-paper-border px-3 py-1.5 font-medium text-ink-soft opacity-50 dark:border-night-border dark:text-ink-soft-dark";

  return (
    <nav aria-label={indicatorLabel} className="flex items-center justify-center gap-3 text-sm">
      {currentPage > 1 ? (
        <Link href={hrefFor(currentPage - 1)} className={linkClass}>
          {previousLabel}
        </Link>
      ) : (
        <span className={disabledClass}>{previousLabel}</span>
      )}
      <span className="text-ink-soft dark:text-ink-soft-dark">{indicatorLabel}</span>
      {currentPage < totalPages ? (
        <Link href={hrefFor(currentPage + 1)} className={linkClass}>
          {nextLabel}
        </Link>
      ) : (
        <span className={disabledClass}>{nextLabel}</span>
      )}
    </nav>
  );
}
