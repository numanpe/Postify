import { NextResponse } from "next/server";

import { pullEngagementData } from "@/lib/jobs/pull-engagement";

// Same CRON_SECRET-gated pattern as the other job routes — see
// process-campaign-items/route.ts for the full reasoning.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse(null, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const result = await pullEngagementData();
  return NextResponse.json(result);
}
