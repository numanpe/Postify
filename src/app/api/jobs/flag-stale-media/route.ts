import { NextResponse } from "next/server";

import { flagStaleMedia } from "@/lib/jobs/flag-stale-media";

// Same CRON_SECRET-gated pattern as the other two job routes — see
// process-campaign-items/route.ts for the full reasoning.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse(null, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const result = await flagStaleMedia();
  return NextResponse.json(result);
}
