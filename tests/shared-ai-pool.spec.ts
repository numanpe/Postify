import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/password";

// Requires PLATFORM_GEMINI_API_KEY to be set wherever the dev server
// this suite runs against is running (see .env.example) — the shared
// "Free AI" pool is optional infrastructure the deployment owner
// provisions, so it's genuinely unset in this repo's normal state, and
// these tests correctly skip rather than fail when that's the case
// (PrismaClient's own dotenv side-effect below means process.env here
// reflects the real .env at test-run time, same file the dev server
// itself loads). The resolver's real-call-then-fallback behavior was
// separately verified directly (bypassing the UI) with a real DB/real
// failed-API-call script; these tests cover the user-visible surfaces
// that behavior feeds into: the exhaustion notice and the admin usage
// table.
const db = new PrismaClient();
const PLATFORM_KEY_CONFIGURED = Boolean(process.env.PLATFORM_GEMINI_API_KEY);

async function todayDateOnly(): Promise<Date> {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

test.describe("Shared Free AI text pool", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("exhaustion notice appears on /studio when today's shared pool is marked exhausted, and clears once reset", async ({
    page,
  }) => {
    test.skip(!PLATFORM_KEY_CONFIGURED, "PLATFORM_GEMINI_API_KEY not configured for this dev server");
    const email = "e2e-shared-pool@postify.test";
    const password = "e2e-test-pass-123";
    const date = await todayDateOnly();

    const stale = await db.user.findUnique({ where: { email }, include: { memberships: true } });
    if (stale) {
      for (const m of stale.memberships) {
        await db.companyMember.deleteMany({ where: { companyId: m.companyId } });
        await db.company.delete({ where: { id: m.companyId } }).catch(() => {});
      }
      await db.user.delete({ where: { id: stale.id } });
    }
    await db.sharedAiUsage.deleteMany({ where: { provider: "GEMINI", date } });

    const user = await db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
    const company = await db.company.create({
      data: { name: "E2E Shared Pool Co", primaryIndustry: "Retail & E-commerce" },
    });
    await db.companyMember.create({ data: { userId: user.id, companyId: company.id, role: "OWNER" } });

    await page.goto("/auth/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    // Not exhausted yet — no notice.
    await page.goto("/studio");
    await expect(page.getByText("Today's free AI quota is used up")).not.toBeVisible();

    // Real exhaustion recorded (same shape the real circuit breaker
    // writes on a genuine 429).
    await db.sharedAiUsage.upsert({
      where: { provider_date: { provider: "GEMINI", date } },
      create: { provider: "GEMINI", date, exhaustedAt: new Date() },
      update: { exhaustedAt: new Date() },
    });

    await page.reload();
    await expect(page.getByText("Today's free AI quota is used up")).toBeVisible();

    // Reset (simulating the next day / quota refresh) — notice clears.
    await db.sharedAiUsage.deleteMany({ where: { provider: "GEMINI", date } });
    await page.reload();
    await expect(page.getByText("Today's free AI quota is used up")).not.toBeVisible();

    // Real end-to-end generation still works (falls back to template
    // gracefully since the configured key is a fake placeholder) —
    // confirms no regression/crash for a real user on this path.
    await page.locator("#topic").fill("our new product line");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.getByText("Pick the caption you like best")).toBeVisible({ timeout: 20_000 });

    await db.companyMember.deleteMany({ where: { companyId: company.id } });
    await db.company.delete({ where: { id: company.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.sharedAiUsage.deleteMany({ where: { provider: "GEMINI", date } });
  });
});

test.describe("Admin panel — Free AI pool usage", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows real usage rows", async ({ page }) => {
    const adminEmail = "e2e-shared-pool-admin@postify.test";
    const adminPassword = "e2e-test-pass-123";
    const date = await todayDateOnly();

    const stale = await db.user.findUnique({ where: { email: adminEmail } });
    if (stale) await db.user.delete({ where: { id: stale.id } });

    const admin = await db.user.create({
      data: { email: adminEmail, passwordHash: await hashPassword(adminPassword), adminRole: "ADMIN" },
    });
    await db.sharedAiUsage.upsert({
      where: { provider_date: { provider: "GEMINI", date } },
      create: { provider: "GEMINI", date, successCount: 7 },
      update: { successCount: 7, exhaustedAt: null },
    });

    await page.goto("/auth/login");
    await page.locator("#email").fill(adminEmail);
    await page.locator("#password").fill(adminPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    await page.goto("/admin");
    const usageHeading = page.getByRole("heading", { name: "Free AI pool usage" });
    await expect(usageHeading).toBeVisible();
    // Scoped to the usage table specifically (not the Companies table
    // below it, which can independently contain "GEMINI"-adjacent text
    // in test company names/emails) — the usage table is this
    // heading's very next sibling.
    const usageTable = usageHeading.locator("xpath=following-sibling::div[1]//table");
    const row = usageTable.locator("tr", { hasText: "GEMINI" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("7");

    await db.sharedAiUsage.deleteMany({ where: { provider: "GEMINI", date } });
    await db.user.delete({ where: { id: admin.id } });
  });
});
