// One shared loading-placeholder primitive, composed differently per
// page's own real layout (see the loading.tsx files under src/app) —
// not a generic "spinner everywhere" fix. Server-safe (no "use client"),
// since Next.js renders loading.tsx itself while the real page's async
// Server Component is still fetching.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-paper-border/60 dark:bg-night-border/60 ${className}`} />;
}
