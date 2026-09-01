import { Skeleton } from "@/components/ui/skeleton";

// Real Next.js route-segment loading state (App Router auto-wraps this
// page in Suspense) — shown instantly while the real page's DB queries
// (media assets + recent activity) are still in flight, instead of a
// blank page. Shape roughly mirrors the real grid, not exact.
export default function MediaLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-lg border border-paper-border p-2 dark:border-night-border">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
