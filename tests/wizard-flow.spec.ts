import { test, expect } from "@playwright/test";

// Part 5.2's explicit ask: verify the full guided flow end-to-end
// (Step 1 generate copy -> Step 2 select format -> Step 3 preview/
// schedule), and verify direct deep-links to the standalone tools
// still bypass the wizard. Poster path only (not video) — video
// generation is a real multi-second ffmpeg render, too slow for a
// per-test budget; the poster path exercises the exact same wizard
// wiring (Step 1 -> Step 2 -> Step 3 query-param handoff).

test.describe("EN / LTR", () => {
  test.use({ storageState: "playwright/.auth/en.json" });

  test("Deep-linked standalone tools bypass the wizard", async ({ page }) => {
    await page.goto("/studio/poster");
    await expect(page.getByRole("heading", { name: "Poster Studio" })).toBeVisible();

    await page.goto("/studio/video");
    await expect(page.getByRole("heading", { name: "Video Studio" })).toBeVisible();

    await page.goto("/repurpose");
    await expect(page).toHaveURL(/\/repurpose$/);
  });

  test("Full guided wizard: Step 1 generate -> Step 2 create poster -> Step 3 preview", async ({ page }) => {
    // Step 1
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: "What are we posting about?" })).toBeVisible();
    await page.locator("#topic").fill("our weekend rental deals");
    await page.getByRole("button", { name: "Generate", exact: true }).click();

    // Real generation — 3 real caption variants from the actual
    // free-tier text provider, not mocked.
    const nextButton = page.getByRole("button", { name: "Next: Create Asset" });
    await expect(nextButton).toBeVisible({ timeout: 20_000 });
    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await nextButton.click();

    // Step 2
    await expect(page).toHaveURL(/\/studio\/design\?/);
    await expect(page.getByRole("heading", { name: "Turn it into a poster or video" })).toBeVisible();
    // Poster toggle is the default; headline field should be pre-filled
    // from Step 1's chosen caption, not empty.
    const headline = page.locator("#headline");
    await expect(headline).not.toHaveValue("");
    await page.getByRole("button", { name: "Generate poster", exact: true }).click();

    // Real poster render (Satori + resvg, no external API calls) —
    // genuinely waiting on it, not simulated.
    await expect(page).toHaveURL(/\/studio\/publish\?assetType=poster/, { timeout: 30_000 });

    // Step 3
    await expect(page.getByRole("heading", { name: "Preview & publish" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Instagram" })).toBeVisible();
    await expect(page.getByText("Suggested time")).toBeVisible();
  });
});

test.describe("AR / RTL", () => {
  test.use({ storageState: "playwright/.auth/ar.json" });

  test("Wizard Step 1 renders correctly in Arabic", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "عمّ سننشر؟" })).toBeVisible();
    await expect(page.getByRole("button", { name: "اقترح فكرة اليوم تلقائيًا" })).toBeVisible();
  });
});
