"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { recomputeCreativeDnaPreferences } from "@/lib/creative-dna/aggregate";
import type { CreativeDnaConfidenceScores } from "@/lib/creative-dna/types";

// Part 3's real lock control — freezes a topic's preference score at
// whatever it currently is; aggregate.ts's recomputeCreativeDnaPreferences
// carries it forward unchanged on every future run rather than letting
// new signals move it. New signals against a locked topic are still
// recorded in the CreativeSignal log (the raw event history stays
// complete) — only the displayed/consumed score stops moving.
export async function lockCreativeDnaTopic(topic: string): Promise<void> {
  const { company } = await requireCompany();

  await db.creativeDna.update({
    where: { companyId: company.id },
    data: { lockedTopics: { push: topic } },
  });

  revalidatePath("/settings");
}

export async function unlockCreativeDnaTopic(topic: string): Promise<void> {
  const { company } = await requireCompany();

  const creativeDna = await db.creativeDna.findUnique({
    where: { companyId: company.id },
    select: { lockedTopics: true },
  });
  if (!creativeDna) return;

  await db.creativeDna.update({
    where: { companyId: company.id },
    data: { lockedTopics: creativeDna.lockedTopics.filter((t) => t !== topic) },
  });

  revalidatePath("/settings");
}

// Real, destructive reset — clears the everyday-usage signal history
// (delete/publish/edit/regenerate/engagement-as-correction) and every
// lock, so the next recomputation starts genuinely fresh. Deliberately
// scoped to that alone: confidenceScores.topics/peakPublishHours (real
// measured platform-engagement history, computed independently by
// learning.ts/smart-scheduler.ts from EngagementSnapshot) are actual
// analytics, not an assumption the app made about the company, so a
// "reset what you've taught us" action doesn't touch them — the UI
// copy says this explicitly rather than leaving it ambiguous what
// "reset" actually did.
export async function resetCreativeDnaLearning(): Promise<void> {
  const { company } = await requireCompany();

  await db.creativeSignal.deleteMany({ where: { companyId: company.id } });

  const creativeDna = await db.creativeDna.findUnique({
    where: { companyId: company.id },
    select: { confidenceScores: true },
  });
  const existingScores = (creativeDna?.confidenceScores ?? {}) as Partial<CreativeDnaConfidenceScores>;
  const { preferences: _removed, ...rest } = existingScores;
  void _removed;

  await db.creativeDna.update({
    where: { companyId: company.id },
    data: { lockedTopics: [], confidenceScores: rest as unknown as Prisma.InputJsonValue },
  });

  // Nothing left to recompute from (the signal log is now empty), but
  // this keeps the shape consistent rather than leaving a stale
  // `preferences` object lying around under a slightly different code
  // path.
  await recomputeCreativeDnaPreferences(company.id);

  revalidatePath("/settings");
}
