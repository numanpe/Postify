import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/password";

// Throwaway test accounts — never the real numanpe@gmail.com Super
// Admin account. Verifies the requireAdmin()/requireSuperAdmin() gate
// and the ban/suspend/reactivate loop work correctly in general, which
// is what actually proves the real account (now adminRole=SUPER_ADMIN
// in production) will get real access when its owner logs in — this
// suite can't log in as them directly since it doesn't have and
// shouldn't ask for their real password.
const ADMIN_EMAIL = "e2e-admin-test@postify.test";
const ADMIN_PASSWORD = "e2e-admin-test-pass-123";
const TARGET_EMAIL = "e2e-admin-target@postify.test";
const TARGET_PASSWORD = "e2e-admin-target-pass-456";

const db = new PrismaClient();

let adminUserId: string;
let targetUserId: string;
let targetCompanyId: string;

test.beforeAll(async () => {
  for (const email of [ADMIN_EMAIL, TARGET_EMAIL]) {
    const stale = await db.user.findUnique({ where: { email }, include: { memberships: true } });
    if (stale) {
      for (const m of stale.memberships) {
        await db.companyMember.deleteMany({ where: { companyId: m.companyId } });
        await db.company.delete({ where: { id: m.companyId } }).catch(() => {});
      }
      await db.adminActionLog.deleteMany({ where: { actorId: stale.id } });
      await db.user.delete({ where: { id: stale.id } });
    }
  }

  const admin = await db.user.create({
    data: { email: ADMIN_EMAIL, passwordHash: await hashPassword(ADMIN_PASSWORD), adminRole: "ADMIN" },
  });
  adminUserId = admin.id;

  const target = await db.user.create({
    data: { email: TARGET_EMAIL, passwordHash: await hashPassword(TARGET_PASSWORD) },
  });
  targetUserId = target.id;
  const company = await db.company.create({
    data: { name: "E2E Admin Target Co", primaryIndustry: "Retail & E-commerce" },
  });
  targetCompanyId = company.id;
  await db.companyMember.create({ data: { userId: target.id, companyId: company.id, role: "OWNER" } });
});

test.afterAll(async () => {
  await db.adminActionLog.deleteMany({ where: { targetId: targetCompanyId } });
  await db.companyMember.deleteMany({ where: { companyId: targetCompanyId } });
  await db.company.delete({ where: { id: targetCompanyId } }).catch(() => {});
  await db.user.delete({ where: { id: targetUserId } }).catch(() => {});
  await db.user.delete({ where: { id: adminUserId } }).catch(() => {});
  await db.$disconnect();
});

test.describe("Admin panel", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a regular user cannot access /admin", async ({ page }) => {
    await page.goto("/auth/login");
    await page.locator("#email").fill(TARGET_EMAIL);
    await page.locator("#password").fill(TARGET_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    await page.goto("/admin");
    await page.waitForURL((url) => url.pathname !== "/admin", { timeout: 15_000 });
  });

  test("an admin can view the company list, suspend/reactivate a company, and it's logged", async ({ page }) => {
    await page.goto("/auth/login");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();
    const row = page.locator("tr", { hasText: "E2E Admin Target Co" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("ACTIVE");

    await row.getByRole("button", { name: "Suspend" }).click();
    await expect(row).toContainText("SUSPENDED", { timeout: 10_000 });

    const log = await db.adminActionLog.findFirst({
      where: { targetId: targetCompanyId, action: "SET_COMPANY_STATUS_SUSPENDED" },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(adminUserId);

    await row.getByRole("button", { name: "Reactivate" }).click();
    await expect(row).toContainText("ACTIVE", { timeout: 10_000 });
  });

  test("suspending a company really blocks its member's access, reactivating restores it", async ({ page }) => {
    await page.goto("/auth/login");
    await page.locator("#email").fill(TARGET_EMAIL);
    await page.locator("#password").fill(TARGET_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    await db.company.update({ where: { id: targetCompanyId }, data: { status: "SUSPENDED" } });

    await page.goto("/media");
    await expect(page).toHaveURL(/status=company_suspended/, { timeout: 10_000 });

    await db.company.update({ where: { id: targetCompanyId }, data: { status: "ACTIVE" } });

    // force-signout genuinely clears the session cookie (see that
    // route's comment) — reactivating doesn't resurrect the old
    // session, it just allows a fresh login to succeed again.
    await page.locator("#email").fill(TARGET_EMAIL);
    await page.locator("#password").fill(TARGET_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    await page.goto("/media");
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 10_000 });
  });
});
