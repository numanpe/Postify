import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

import { SEED_IDS_PATH, type SeedIds } from "./seed-data";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "local");

async function cleanCompany(companyId: string, userId: string) {
  const db = new PrismaClient();
  await db.poster.deleteMany({ where: { companyId } });
  await db.mediaAsset.deleteMany({ where: { companyId } });
  await db.companyMember.deleteMany({ where: { companyId } });
  await db.company.delete({ where: { id: companyId } }).catch(() => {});
  await db.user.delete({ where: { id: userId } }).catch(() => {});
  await db.$disconnect();
  await fs.rm(path.join(STORAGE_ROOT, companyId), { recursive: true, force: true });
}

export default async function globalTeardown() {
  let raw: string;
  try {
    raw = await fs.readFile(SEED_IDS_PATH, "utf8");
  } catch {
    return; // global-setup never got far enough to write it — nothing to clean up
  }
  const ids = JSON.parse(raw) as SeedIds;
  await cleanCompany(ids.enCompanyId, ids.enUserId);
  await cleanCompany(ids.arCompanyId, ids.arUserId);
  await fs.rm(SEED_IDS_PATH, { force: true });
}
