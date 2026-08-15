import "server-only";

import { processCampaignItems } from "./process-campaign-items";

// Best-effort: kicks off processing without the caller waiting for it.
// In a long-running Node process (local dev, a persistent host) this
// reliably continues after the response is sent. On serverless hosts
// the function may be frozen once the response returns, so this is an
// optimization ("start early"), not a delivery guarantee — the
// CRON_SECRET-protected route (src/app/api/jobs/process-campaign-items/
// route.ts) is the actual reliability mechanism in production; wire it
// to a real scheduler (e.g. Vercel Cron) there. See README.md.
export function triggerCampaignProcessing(): void {
  void processCampaignItems().catch((error: unknown) => {
    console.error("Background campaign processing failed:", error);
  });
}
