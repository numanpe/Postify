import { Skeleton } from "@/components/ui/skeleton";

// Real Next.js route-segment loading state — added after real
// production measurement showed this specific step at ~7.5s FCP (the
// slowest page measured this session), the highest-value place for a
// perceived-speed fix per Part 4's own "heavier pages get skeletons,
// not a raw-time chase" framing. Shown while the real photo/video
// asset + preferred-template-order queries are in flight.
export default function StudioDesignLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-10 w-full max-w-lg" />
      <Skeleton className="h-24 w-full max-w-lg" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
      <Skeleton className="h-11 w-40" />
    </div>
  );
}
