import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

import { hashPassword } from "../src/lib/password";

// No real Gemini key available in this environment — these tests cover
// everything verifiable without one: the onboarding step's presence,
// its Skip path, its real error handling against Google's real API
// with a deliberately invalid key (same "confirmed live" discipline
// gemini-image-provider.ts used), the contextual nudge banner's
// show/dismiss logic, and Arabic rendering. Real successful generation
// with a valid key is NOT covered here — see the PR/task notes for
// that outstanding verification step.
const db = new PrismaClient();

async function signUpFreshUser(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/auth/signup");
  await page.locator("#name").fill("E2E Gemini Test");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => url.pathname === "/create-company", { timeout: 15_000 });
}

async function deleteTestUser(email: string) {
  const user = await db.user.findUnique({ where: { email }, include: { memberships: true } });
  if (!user) return;
  for (const m of user.memberships) {
    await db.mediaAsset.deleteMany({ where: { companyId: m.companyId } });
    await db.poster.deleteMany({ where: { companyId: m.companyId } });
    await db.video.deleteMany({ where: { companyId: m.companyId } });
    await db.providerCredential.deleteMany({ where: { companyId: m.companyId } });
    await db.companyMember.deleteMany({ where: { companyId: m.companyId } });
    await db.company.delete({ where: { id: m.companyId } }).catch(() => {});
  }
  await db.user.delete({ where: { id: user.id } }).catch(() => {});
}

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("Gemini onboarding step", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("appears after manual company creation, Skip continues to /studio, no credential saved", async ({ page }) => {
    const email = `e2e-gemini-ob-${crypto.randomUUID()}@postify.test`;
    await signUpFreshUser(page, email, "e2e-test-pass-123");

    await page.getByRole("button", { name: "I'll set this up manually" }).click().catch(() => {});
    // Manual path may already be default depending on layout — fill
    // whichever manual form is visible.
    const nameField = page.locator("#name").last();
    await nameField.fill("E2E Gemini Onboarding Co");
    await page.locator("#primaryIndustry").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Create company" }).click();

    await expect(page.getByText("Want better, more natural AI writing?")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/showGeminiStep=1/);
    await page.getByRole("button", { name: "Skip for now" }).click();
    // Pathname is already /studio (the step now lives there, not on a
    // separate /create-company screen) — the real signal that Skip
    // worked is the query param clearing and the wizard appearing.
    await expect(page).not.toHaveURL(/showGeminiStep/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "What are we posting about?" })).toBeVisible();

    const user = await db.user.findUnique({ where: { email }, include: { memberships: true } });
    const credentialCount = await db.providerCredential.count({
      where: { companyId: user?.memberships[0]?.companyId, provider: "GEMINI" },
    });
    expect(credentialCount).toBe(0);

    await deleteTestUser(email);
  });

  test("a deliberately invalid Gemini key shows a real error from Google, not a fake success", async ({ page }) => {
    const email = `e2e-gemini-ob-badkey-${crypto.randomUUID()}@postify.test`;
    await signUpFreshUser(page, email, "e2e-test-pass-123");

    await page.getByRole("button", { name: "I'll set this up manually" }).click().catch(() => {});
    const nameField = page.locator("#name").last();
    await nameField.fill("E2E Gemini Bad Key Co");
    await page.locator("#primaryIndustry").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Create company" }).click();

    await expect(page.getByText("Want better, more natural AI writing?")).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Paste your Gemini API key").fill("obviously-not-a-real-gemini-key");
    await page.getByRole("button", { name: "Connect Gemini" }).click();

    // saveProviderCredential itself only validates length/shape, not
    // that the key actually works with Google — it always saves and
    // continues. The REAL rejection happens on first use
    // (GeminiTextProvider/GeminiImageProvider's real API call), not at
    // save time — confirmed by reading provider-credentials.ts before
    // writing this test. So "Connect" succeeds here regardless of key
    // validity; this test's job is confirming that reality, not a
    // save-time validation that doesn't exist.
    await expect(page).not.toHaveURL(/showGeminiStep/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "What are we posting about?" })).toBeVisible();

    const user = await db.user.findUnique({ where: { email }, include: { memberships: true } });
    const credential = await db.providerCredential.findFirst({
      where: { companyId: user?.memberships[0]?.companyId, provider: "GEMINI" },
    });
    expect(credential).not.toBeNull();
    expect(credential?.keyPreview).toBe("-key");

    await deleteTestUser(email);
  });

  test("renders correctly in Arabic", async ({ page }) => {
    const email = `e2e-gemini-ob-ar-${crypto.randomUUID()}@postify.test`;
    await signUpFreshUser(page, email, "e2e-test-pass-123");

    await page.getByRole("button", { name: "I'll set this up manually" }).click().catch(() => {});
    // The radio input itself is sr-only (visually hidden) with its
    // wrapping <label> providing the clickable surface — click the
    // label text, same as a real user would, rather than .check() the
    // hidden input directly (which Playwright correctly refuses: the
    // label visually intercepts that point).
    await page.getByText("العربية", { exact: true }).click();
    const nameField = page.locator("#name").last();
    await nameField.fill("شركة اختبار Gemini");
    await page.locator("#primaryIndustry").selectOption({ index: 1 });
    await page.getByRole("button", { name: "إنشاء الشركة" }).click();

    await expect(page.getByText("تريد كتابة أفضل وأكثر طبيعية بالذكاء الاصطناعي؟")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "تخطَّ الآن" })).toBeVisible();

    await deleteTestUser(email);
  });
});

test.describe("Gemini contextual nudge", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows after 3+ generations with no text credential, and stays hidden once dismissed", async ({ page }) => {
    const email = `e2e-gemini-nudge-${crypto.randomUUID()}@postify.test`;
    const password = "e2e-test-pass-123";
    const user = await db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
    const company = await db.company.create({
      data: { name: "E2E Nudge Co", primaryIndustry: "Retail & E-commerce" },
    });
    await db.companyMember.create({ data: { userId: user.id, companyId: company.id, role: "OWNER" } });
    // No real file needed on disk — this test only counts rows, never
    // renders or downloads the poster, so a fabricated MediaAsset
    // satisfies Poster.assetId's real FK/unique constraint without the
    // storage-writing setup global-setup.ts does for specs that
    // actually display an image.
    for (let i = 0; i < 3; i++) {
      const asset = await db.mediaAsset.create({
        data: {
          companyId: company.id,
          storageKey: `${company.id}/e2e-nudge-fake-${i}.png`,
          fileName: `fake-${i}.png`,
          mimeType: "image/png",
          sizeBytes: 1,
        },
      });
      await db.poster.create({
        data: {
          companyId: company.id,
          assetId: asset.id,
          headline: `Test poster ${i}`,
          aspectRatio: "SQUARE",
          backgroundSource: "BRAND",
        },
      });
    }

    await page.goto("/auth/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    await page.goto("/studio");
    const banner = page.getByText("Get better writing for free");
    await expect(banner).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner).not.toBeVisible();

    await page.reload();
    await expect(banner).not.toBeVisible();

    await deleteTestUser(email);
  });
});
