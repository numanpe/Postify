import { NextResponse } from "next/server";

import { processPublishJobs } from "@/lib/jobs/process-publish-jobs";

// Meant to be triggered by an external scheduler in production (e.g. a
// Vercel Cron entry in vercel.json) — same pattern as
// /api/jobs/process-campaign-items. Refuses to run at all if
// CRON_SECRET isn't configured, rather than falling back to an
// unauthenticated open endpoint.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse(null, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const result = await processPublishJobs(5);
  return NextResponse.json(result);
}
