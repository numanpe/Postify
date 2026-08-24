import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/password";

// Requires PLATFORM_CLOUDFLARE_ACCOUNT_ID/API_TOKEN to be set wherever
// the dev server this suite runs against is running — optional
// platform infrastructure, genuinely unset in this repo's normal
// state, so these tests correctly skip rather than fail when that's
// the case (same pattern as shared-ai-pool.spec.ts for the text pool).
const db = new PrismaClient();
const CLOUDFLARE_CONFIGURED = Boolean(
  process.env.PLATFORM_CLOUDFLARE_ACCOUNT_ID && process.env.PLATFORM_CLOUDFLARE_API_TOKEN,
);

async function todayDateOnly(): Promise<Date> {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function setupCompany(email: string, password: string, locale: "EN" | "AR", name: string) {
  const stale = await db.user.findUnique({ where: { email }, include: { memberships: true } });
  if (stale) {
    for (const m of stale.memberships) {
      await db.poster.deleteMany({ where: { companyId: m.companyId } });
      await db.mediaAsset.deleteMany({ where: { companyId: m.companyId } });
      await db.companyMember.deleteMany({ where: { companyId: m.companyId } });
      await db.company.delete({ where: { id: m.companyId } }).catch(() => {});
    }
    await db.user.delete({ where: { id: stale.id } });
  }
  const user = await db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
  const company = await db.company.create({
    data: { name, primaryIndustry: "Agriculture", locale },
  });
  await db.companyMember.create({ data: { userId: user.id, companyId: company.id, role: "OWNER" } });
  return { user, company };
}

async function cleanup(userId: string, companyId: string) {
  await db.poster.deleteMany({ where: { companyId } });
  await db.mediaAsset.deleteMany({ where: { companyId } });
  await db.companyMember.deleteMany({ where: { companyId } });
  await db.company.delete({ where: { id: companyId } }).catch(() => {});
  await db.user.delete({ where: { id: userId } }).catch(() => {});
}

test.describe("Shared Free AI image pool (Cloudflare)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("real end-to-end poster generation via the shared Cloudflare pool, EN, quality gate passes", async ({ page }) => {
    test.skip(!CLOUDFLARE_CONFIGURED, "PLATFORM_CLOUDFLARE_ACCOUNT_ID/API_TOKEN not configured for this dev server");
    const email = "e2e-cf-pool-en@postify.test";
    const password = "e2e-test-pass-123";
    const { user, company } = await setupCompany(email, password, "EN", "E2E Cloudflare Pool Co");

    await page.goto("/auth/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    await page.goto("/studio/poster");
    await page.locator("#headline").fill("Our new organic tomato line");
    await page.locator("#backgroundSource").selectOption("AI");
    await page.getByRole("button", { name: "Generate poster", exact: true }).click();
    // Real Cloudflare generation genuinely takes a few seconds — this
    // is a real network call, not a mock, so a generous timeout.
    await expect(page.getByText("Poster generated")).toBeVisible({ timeout: 30_000 });

    const poster = await db.poster.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } });
    expect(poster).not.toBeNull();

    await cleanup(user.id, company.id);
  });

  test("real end-to-end poster generation via the shared Cloudflare pool, AR/RTL, quality gate passes", async ({
    page,
  }) => {
    test.skip(!CLOUDFLARE_CONFIGURED, "PLATFORM_CLOUDFLARE_ACCOUNT_ID/API_TOKEN not configured for this dev server");
    const email = "e2e-cf-pool-ar@postify.test";
    const password = "e2e-test-pass-123";
    const { user, company } = await setupCompany(email, password, "AR", "شركة اختبار Cloudflare");

    await page.goto("/auth/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", { timeout: 10_000 });

    await page.goto("/studio/poster");
    await page.locator("#headline").fill("مجموعتنا الجديدة من الطماطم العضوية");
    await page.locator("#backgroundSource").selectOption("AI");
    await page.getByRole("button", { name: "إنشاء الملصق", exact: true }).click();
    await expect(page.getByText("تم إنشاء الملصق")).toBeVisible({ timeout: 30_000 });

    const poster = await db.poster.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } });
    expect(poster).not.toBeNull();

    await cleanup(user.id, company.id);
  });

  test("brand-gradient fallback triggers correctly when the shared pool is exhausted", async ({ page }) => {
    test.skip(!CLOUDFLARE_CONFIGURED, "PLATFORM_CLOUDFLARE_ACCOUNT_ID/API_TOKEN not configured for this dev server");
    const email = "e2e-cf-pool-exhausted@postify.test";
    const password = "e2e-test-pass-123";
    const { user, company } = await setupCompany(email, password, "EN", "E2E Cloudflare Exhausted Co");
    const date = await todayDateOnly();

    await db.sharedAiUsage.upsert({
      where: { provider_date: { provider: "CLOUDFLARE", date } },
      create: { provider: "CLOUDFLARE", date, exhaustedAt: new Date() },
      update: { exhaustedAt: new Date() },
    });

    await page.goto("/auth/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    await page.goto("/studio/poster");
    await page.locator("#headline").fill("Our new organic tomato line");
    await page.locator("#backgroundSource").selectOption("AI");
    await page.getByRole("button", { name: "Generate poster", exact: true }).click();
    // Real: no external call is even attempted once exhausted (circuit
    // breaker) — the gradient renders essentially instantly, no
    // 30s-class wait needed, and — the actual point of this test — no
    // error surfaces despite the shared pool being unavailable.
    await expect(page.getByText("Poster generated")).toBeVisible({ timeout: 10_000 });

    const poster = await db.poster.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } });
    expect(poster?.backgroundSource).toBe("AI");
    const asset = await db.mediaAsset.findUnique({ where: { id: poster!.assetId } });
    expect(asset).not.toBeNull();

    await db.sharedAiUsage.deleteMany({ where: { provider: "CLOUDFLARE", date } });
    await cleanup(user.id, company.id);
  });
});
