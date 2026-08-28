"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

// Real gap this closes (2026-08-29): with no error.tsx anywhere in the
// app, an error that escapes a Server Action's own try/catch — the
// exact case a real narrated video generation hit when Vercel's hard
// 300s function timeout killed the request mid-flight, confirmed via
// real production logs (POST /studio/design, 2026-08-28) — had nothing
// to catch it client-side either. React's action-error propagation
// crashed the page itself (observed for real: a generic browser "This
// page couldn't load" interstitial), not this app's own honest
// messaging. Scoped to /studio (not the whole app) because that's
// exactly where the real evidence is — every studio sub-route
// (poster/video/captions/the design wizard) shares this one real
// generation-timeout risk; other route segments haven't shown it and
// don't need this file per Next.js's per-segment error.tsx convention.
//
// This is a real safety net, not a substitute for VideoForm's own
// timeout messaging (still the first line of defense — see
// generatingSlowNotice/generatingVerySlowWarning/generatingSilentFailure)
// — this only catches the case that already got past that: a genuine
// thrown/rejected error React couldn't otherwise recover from.
export default function StudioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dict = useDict().errorBoundary;

  useEffect(() => {
    console.error("[studio error boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-paper-border p-8 text-center dark:border-night-border">
      <h1 className="text-lg font-semibold">{dict.title}</h1>
      <p className="max-w-md text-sm text-ink-soft dark:text-ink-soft-dark">{dict.message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          {dict.tryAgain}
        </Button>
        <Link href="/studio" className="text-sm font-medium underline">
          {dict.goToStudio}
        </Link>
      </div>
    </div>
  );
}
