import "server-only";

import { processCampaignItems } from "./process-campaign-items";

// Best-effort: kicks off processing without the caller waiting for it.
// In a long-running Node process (local dev, a persistent host) this
// reliably continues after the response is sent. On serverless hosts
// the function may be frozen once the response returns, so this is an
// optimization ("start early"), not a delivery guarantee — the
// CRON_SECRET-protected dispatcher (src/app/api/jobs/run/route.ts,
// ?job=process-campaign-items) is the actual reliability mechanism in
// production; wire it to a real scheduler (e.g. Vercel Cron) there. See
// README.md. Folded into one shared route rather than one per job — a
// real deploy failure ("No more than 12 Serverless Functions... on the
// Hobby plan") is why this isn't four separate route.ts files anymore.
//
// publish.ts's equivalent (triggerPublishProcessing) was removed: its
// two callers (createPublishJob's "now" path, retryPublishJob) both
// switched to a real, awaited processSinglePublishJob call instead,
// after this same fire-and-forget pattern turned out to be a real gap
// for immediate publishing on serverless — see publish.ts's own comment
// at those call sites.
export function triggerCampaignProcessing(): void {
  void processCampaignItems().catch((error: unknown) => {
    console.error("Background campaign processing failed:", error);
  });
}
