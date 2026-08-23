import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

import { hashPassword } from "../src/lib/password";

// Self-contained test user (not EN_USER/AR_USER) — this suite mutates
// status and password directly, which would corrupt the shared seeded
// accounts every other spec depends on.
const TEST_EMAIL = "e2e-password-reset@postify.test";
const ORIGINAL_PASSWORD = "e2e-original-pass-123";
const NEW_PASSWORD = "e2e-new-pass-456";

const db = new PrismaClient();

// Mirrors src/lib/token.ts's real hashing convention (SHA-256 hex of a
// 32-byte random token) without importing that "server-only"-guarded
// module into a plain-Node Playwright spec.
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

let userId: string;

test.beforeAll(async () => {
  const stale = await db.user.findUnique({ where: { email: TEST_EMAIL } });
  if (stale) {
    await db.passwordResetToken.deleteMany({ where: { userId: stale.id } });
    await db.user.delete({ where: { id: stale.id } });
  }

  const user = await db.user.create({
    data: { email: TEST_EMAIL, passwordHash: await hashPassword(ORIGINAL_PASSWORD) },
  });
  userId = user.id;
});

test.afterAll(async () => {
  await db.passwordResetToken.deleteMany({ where: { userId } });
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

test.describe("Password reset", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a valid single-use token resets the password, is rejected on reuse, and the new password logs in", async ({
    page,
  }) => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    await page.goto(`/auth/reset-password?token=${rawToken}`);
    await page.locator("#password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText("Your password has been reset.")).toBeVisible();

    // Reusing the same (now-used) token must be rejected, not silently
    // accepted a second time.
    await page.goto(`/auth/reset-password?token=${rawToken}`);
    await page.locator("#password").fill("another-attempt-789");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible();

    // Proves the reset actually took effect, not just that the UI said so.
    await page.goto("/auth/login");
    await page.locator("#email").fill(TEST_EMAIL);
    await page.locator("#password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });
  });

  test("an expired token is rejected", async ({ page }) => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() - 1000) },
    });

    await page.goto(`/auth/reset-password?token=${rawToken}`);
    await page.locator("#password").fill("irrelevant-pass-000");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible();
  });

  test("an unknown token is rejected", async ({ page }) => {
    await page.goto(`/auth/reset-password?token=${crypto.randomBytes(32).toString("hex")}`);
    await page.locator("#password").fill("irrelevant-pass-111");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible();
  });

  test("requesting a reset for an unregistered email still shows the generic sent message (no enumeration)", async ({
    page,
  }) => {
    await page.goto("/auth/forgot-password");
    await page.locator("#email").fill("definitely-not-registered-e2e@postify.test");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/we've sent a link/i)).toBeVisible();
  });
});

test.describe("Account status enforcement", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a banned account cannot log in, and reactivating restores access", async ({ page }) => {
    await db.user.update({ where: { id: userId }, data: { status: "BANNED" } });

    await page.goto("/auth/login");
    await page.locator("#email").fill(TEST_EMAIL);
    await page.locator("#password").fill(NEW_PASSWORD); // set by the reset test above
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("This account has been banned.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);

    await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });

    // Fresh navigation + refill rather than resubmitting the same form
    // instance — isolates this assertion to "reactivation restores
    // access" instead of also depending on how uncontrolled input
    // values survive a useActionState re-render.
    await page.goto("/auth/login");
    await page.locator("#email").fill(TEST_EMAIL);
    await page.locator("#password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });
  });

  test("a suspended account cannot log in", async ({ page }) => {
    await db.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });

    await page.goto("/auth/login");
    await page.locator("#email").fill(TEST_EMAIL);
    await page.locator("#password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("This account is suspended.")).toBeVisible();

    await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } }); // leave clean for afterAll
  });
});
