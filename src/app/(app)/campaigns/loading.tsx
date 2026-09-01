import { Skeleton } from "@/components/ui/skeleton";

// Real Next.js route-segment loading state — shown instantly while the
// real page's campaign-list query is in flight.
export default function CampaignsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-16 w-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
