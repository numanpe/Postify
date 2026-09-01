import { Skeleton } from "@/components/ui/skeleton";

// Real Next.js route-segment loading state — the heaviest page in this
// app (real media/poster/video queries plus the largest client JS
// bundle), so previously showed nothing at all until everything was
// ready. Generic card-grid shape since this one route renders three
// real, differently-shaped steps (poster picker, video picker, review)
// depending on mode/step — not worth a skeleton per variant.
export default function StudioModeLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
