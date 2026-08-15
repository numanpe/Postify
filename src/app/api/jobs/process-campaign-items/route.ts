import { NextResponse } from "next/server";

import { processCampaignItems } from "@/lib/jobs/process-campaign-items";

// Meant to be triggered by an external scheduler in production (e.g. a
// Vercel Cron entry in vercel.json hitting this path every few
// minutes, which Vercel authenticates with a bearer token matching
// CRON_SECRET automatically) — this is the real reliability mechanism
// for background jobs; the fire-and-forget trigger after campaign
// creation (src/lib/jobs/trigger.ts) is just a head start. Refuses to
// run at all if CRON_SECRET isn't configured, rather than falling back
// to an unauthenticated open endpoint.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse(null, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const result = await processCampaignItems(5);
  return NextResponse.json(result);
}
