import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { hashPassword } from "../src/lib/password";
import { EN_USER, AR_USER, SEED_IDS_PATH, type SeedIds } from "./seed-data";

// Runs once before the whole suite (Playwright's globalSetup, plain
// Node — not a Next.js request, so storage.ts can't be imported here,
// it's guarded with "server-only"). Seeds two real companies (EN and
// AR locale) each with a real poster, so /studio/poster has a real
// "Preview" button to click, matching this app's actual, documented
// locale mechanism (Company.locale in the DB — see get-locale.ts and
// scripts/mobile-audit.mjs's own note on why there's no query-param
// or client-side locale override to fake this with).
//
// Writes the local disk file directly (same layout LocalDiskStorage
// itself writes: storage/local/{companyId}/{randomUUID}-{name}) rather
// than importing the app's storage module, for the same server-only
// reason.
const STORAGE_ROOT = path.join(process.cwd(), "storage", "local");

// A tiny valid PNG (1x1, portrait-safe since we set explicit
// width/height on the MediaAsset row regardless of the file's real
// pixel dimensions) — the previewer only needs a URL that resolves to
// *some* image; pixel-perfect rendering isn't what this E2E test is
// checking, that was already verified with real generated content
// during Task 4's own implementation.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function seedCompany(email: string, password: string, locale: "EN" | "AR") {
  const db = new PrismaClient();

  // Idempotent — a previous run that crashed before global-teardown
  // could leave this email behind, which would otherwise fail the
  // unique-email constraint below.
  const stale = await db.user.findUnique({ where: { email }, include: { memberships: true } });
  if (stale) {
    for (const membership of stale.memberships) {
      await db.publishJob.deleteMany({ where: { companyId: membership.companyId } });
      await db.creativeDna.deleteMany({ where: { companyId: membership.companyId } });
      await db.poster.deleteMany({ where: { companyId: membership.companyId } });
      await db.mediaAsset.deleteMany({ where: { companyId: membership.companyId } });
      await db.socialAccount.deleteMany({ where: { companyId: membership.companyId } });
      await db.companyMember.deleteMany({ where: { companyId: membership.companyId } });
      await db.company.delete({ where: { id: membership.companyId } }).catch(() => {});
      await fs.rm(path.join(STORAGE_ROOT, membership.companyId), { recursive: true, force: true });
    }
    await db.user.delete({ where: { id: stale.id } });
  }

  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
  const company = await db.company.create({
    data: { name: `E2E Social Preview ${locale}`, primaryIndustry: "Retail & E-commerce", locale },
  });
  await db.companyMember.create({ data: { userId: user.id, companyId: company.id, role: "OWNER" } });

  const storageKey = `${company.id}/${randomUUID()}-poster.png`;
  const pngBuffer = Buffer.from(TINY_PNG_BASE64, "base64");
  await fs.mkdir(path.join(STORAGE_ROOT, company.id), { recursive: true });
  await fs.writeFile(path.join(STORAGE_ROOT, storageKey), pngBuffer);

  const asset = await db.mediaAsset.create({
    data: {
      companyId: company.id,
      uploadedById: user.id,
      storageKey,
      fileName: "poster.png",
      mimeType: "image/png",
      sizeBytes: pngBuffer.byteLength,
      width: 1080,
      height: 1920,
      orientation: "portrait",
    },
  });
  await db.poster.create({
    data: {
      companyId: company.id,
      assetId: asset.id,
      headline: locale === "AR" ? "تسوق مجموعتنا الجديدة اليوم." : "Shop our new collection today.",
      aspectRatio: "STORY",
      backgroundSource: "BRAND",
    },
  });

  // So /publish actually renders CreatePublishJobForm (it needs both a
  // poster and a connected account — see publish/page.tsx) instead of
  // the "connect an account first" empty state.
  await db.socialAccount.create({
    data: {
      companyId: company.id,
      platform: "FACEBOOK",
      externalAccountId: "e2e-test-page",
      displayName: "E2E Test Page",
      encryptedToken: "e2e-not-a-real-token",
      tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
    },
  });

  await db.$disconnect();
  return { companyId: company.id, userId: user.id };
}

export default async function globalSetup() {
  const en = await seedCompany(EN_USER.email, EN_USER.password, "EN");
  const ar = await seedCompany(AR_USER.email, AR_USER.password, "AR");

  const ids: SeedIds = { enCompanyId: en.companyId, enUserId: en.userId, arCompanyId: ar.companyId, arUserId: ar.userId };
  await fs.mkdir(path.dirname(SEED_IDS_PATH), { recursive: true });
  await fs.writeFile(SEED_IDS_PATH, JSON.stringify(ids, null, 2));
}
