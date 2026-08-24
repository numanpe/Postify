import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/password";

// Requires PLATFORM_CLOUDFLARE_ACCOUNT_ID/API_TOKEN to be set wherever
// the dev server this suite runs against is running — optional
// platform infrastructure, genuinely unset in this repo's normal
// state (same skip pattern as shared-image-pool.spec.ts).
const db = new PrismaClient();
const CLOUDFLARE_CONFIGURED = Boolean(
  process.env.PLATFORM_CLOUDFLARE_ACCOUNT_ID && process.env.PLATFORM_CLOUDFLARE_API_TOKEN,
);

test.describe("Regenerate background", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("appears only for AI-background posters, and produces a real new poster on click", async ({ page }) => {
    test.skip(!CLOUDFLARE_CONFIGURED, "PLATFORM_CLOUDFLARE_ACCOUNT_ID/API_TOKEN not configured for this dev server");
    const email = "e2e-regen-bg@postify.test";
    const password = "e2e-test-pass-123";

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
    const company = await db.company.create({ data: { name: "E2E Regen Co", primaryIndustry: "Agriculture" } });
    await db.companyMember.create({ data: { userId: user.id, companyId: company.id, role: "OWNER" } });

    await page.goto("/auth/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });

    // First: a BRAND-background poster — the button must NOT appear
    // for it, since regenerating a gradient makes no sense.
    await page.goto("/studio/poster");
    await page.locator("#headline").fill("Our brand gradient poster");
    await page.locator("#backgroundSource").selectOption("BRAND");
    await page.getByRole("button", { name: "Generate poster", exact: true }).click();
    await expect(page.getByText("Poster generated")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Regenerate background" })).toHaveCount(0);

    // Now: a real AI-background poster. Fresh navigation rather than
    // reusing the same page — "Poster generated" is already visible
    // from the BRAND submission above, so re-checking that same text
    // without reloading would resolve immediately against the stale
    // message instead of actually waiting for this second, real
    // (~15-30s) Cloudflare generation to finish.
    await page.goto("/studio/poster");
    await page.locator("#headline").fill("Our new organic tomato line");
    await page.locator("#backgroundSource").selectOption("AI");
    await page.getByRole("button", { name: "Generate poster", exact: true }).click();
    await expect(page.getByText("Poster generated")).toBeVisible({ timeout: 30_000 });

    const regenerateButton = page.getByRole("button", { name: "Regenerate background" }).first();
    await expect(regenerateButton).toBeVisible();

    const postersBefore = await db.poster.count({ where: { companyId: company.id } });
    await regenerateButton.click();
    // Generous timeout: this repeats the same real work the original
    // generation did (text-expansion call + Cloudflare image call),
    // and can genuinely take longer if FLUX hits a transient capacity
    // error and falls through to SDXL within the same attempt (real,
    // confirmed-live behavior from this session's own earlier testing).
    await expect(page.getByText("New background generated")).toBeVisible({ timeout: 60_000 });
    const postersAfter = await db.poster.count({ where: { companyId: company.id } });
    // A real new Poster row, not an in-place edit of the original.
    expect(postersAfter).toBe(postersBefore + 1);

    const [newest, previous] = await db.poster.findMany({
      where: { companyId: company.id, backgroundSource: "AI" },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    expect(newest.headline).toBe(previous.headline);
    expect(newest.id).not.toBe(previous.id);
    expect(newest.assetId).not.toBe(previous.assetId);

    await db.poster.deleteMany({ where: { companyId: company.id } });
    await db.mediaAsset.deleteMany({ where: { companyId: company.id } });
    await db.companyMember.deleteMany({ where: { companyId: company.id } });
    await db.company.delete({ where: { id: company.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });
});
