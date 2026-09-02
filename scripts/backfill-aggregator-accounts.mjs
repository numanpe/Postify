// One-time backfill for the AggregatorAccount redesign (2026-09-03):
// migrates each AggregatorCredential's legacy accountMap (one account ID
// per platform) into real AggregatorAccount rows, so existing real
// connections keep working under the new multi-account model. Excludes
// Upload-Post's reserved "_PROFILE_" key (a different real shape, still
// stored on accountMap directly). Idempotent — safe to re-run, skips any
// (credentialId, platform) pair that already has a row.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PLATFORM_LABELS = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
};

async function main() {
  const credentials = await db.aggregatorCredential.findMany({
    include: { accounts: true },
  });

  let created = 0;
  let skipped = 0;

  for (const credential of credentials) {
    const accountMap = credential.accountMap ?? {};
    const existingPlatforms = new Set(credential.accounts.map((a) => a.platform));

    for (const [platform, accountId] of Object.entries(accountMap)) {
      if (platform === "_PROFILE_") continue;
      if (!PLATFORM_LABELS[platform]) continue;
      if (typeof accountId !== "string" || accountId.trim() === "") continue;
      if (existingPlatforms.has(platform)) {
        skipped++;
        continue;
      }

      await db.aggregatorAccount.create({
        data: {
          credentialId: credential.id,
          platform,
          accountId,
          label: PLATFORM_LABELS[platform],
          isDefault: true,
        },
      });
      created++;
    }
  }

  console.log(`Backfill complete: ${created} AggregatorAccount rows created, ${skipped} already existed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
