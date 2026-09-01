import { Skeleton } from "@/components/ui/skeleton";

// Real Next.js route-segment loading state — shown instantly while the
// real page's campaign+items+media-picker queries are in flight. Grid
// shape (7 columns) mirrors the real weekly calendar
// (campaign-calendar.tsx's buildCalendarWeeks).
export default function CampaignDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
