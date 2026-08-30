import { NextResponse } from "next/server";

import { processCampaignItems } from "@/lib/jobs/process-campaign-items";
import { processPublishJobs } from "@/lib/jobs/process-publish-jobs";
import { flagStaleMedia } from "@/lib/jobs/flag-stale-media";
import { pullEngagementData } from "@/lib/jobs/pull-engagement";
import { db } from "@/lib/db";

// TEMPORARY — real, direct confirmation that the SharedProviderCredential
// migration applied to whatever DATABASE_URL production actually runs
// on at runtime (not inferred from local/prod behaving the same way
// historically). Remove this job entry once confirmed one way or the
// other; it's a one-time diagnostic, not a permanent job.
async function diagSharedCredentialSchema() {
  const columns = await db.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'SharedProviderCredential'
    ORDER BY ordinal_position
  `;
  const indexes = await db.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'SharedProviderCredential'
  `;
  return { columns, indexes };
}

// One dispatcher route for every scheduled job, not four separate
// route.ts files — Vercel's Hobby plan caps a deployment at 12
// Serverless Functions (confirmed the hard way: a real deploy failed
// with "No more than 12 Serverless Functions can be added" once this
// app had four separate /api/jobs/* routes plus everything else).
// vercel.json's cron entries each hit this same route with a different
// ?job= query param instead of each getting their own function.
export const maxDuration = 300;

const JOBS: Record<string, () => Promise<unknown>> = {
  "process-campaign-items": () => processCampaignItems(5),
  "process-publish-jobs": () => processPublishJobs(5),
  "flag-stale-media": () => flagStaleMedia(),
  "pull-engagement": () => pullEngagementData(),
  "diag-shared-credential-schema": () => diagSharedCredentialSchema(),
};

// Same CRON_SECRET-gated pattern every job route already used — refuses
// to run at all if CRON_SECRET isn't configured, rather than falling
// back to an unauthenticated open endpoint.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse(null, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const job = searchParams.get("job");
  const handler = job ? JOBS[job] : undefined;
  if (!handler) {
    return NextResponse.json({ error: `Unknown job: ${job ?? "(missing)"}` }, { status: 400 });
  }

  const result = await handler();
  return NextResponse.json(result);
}
