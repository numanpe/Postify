import "server-only";

import { processCampaignItems } from "./process-campaign-items";
import { processPublishJobs } from "./process-publish-jobs";

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
export function triggerCampaignProcessing(): void {
  void processCampaignItems().catch((error: unknown) => {
    console.error("Background campaign processing failed:", error);
  });
}

// Same reasoning as triggerCampaignProcessing — see
// src/app/api/jobs/run/route.ts (?job=process-publish-jobs) for the real
// reliability mechanism.
export function triggerPublishProcessing(): void {
  void processPublishJobs().catch((error: unknown) => {
    console.error("Background publish processing failed:", error);
  });
}
