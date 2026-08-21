import { test, expect } from "@playwright/test";

// Task 2 verification: the motion-template selector's client-side
// reactivity (video-form.tsx) in a real browser. The templates
// themselves (real ffmpeg renders — Lower-Third Promo, Waveform
// Captions) were already verified with real full-pipeline video
// generation during Task 2's implementation; this only checks the
// form control that picks between them, which wasn't previously
// browser-tested (no Chrome extension connection at the time).

test.describe("EN / LTR", () => {
  test.use({ storageState: "playwright/.auth/en.json" });

  test("Motion style hint updates as the template selection changes", async ({ page }) => {
    await page.goto("/studio/video");

    const select = page.locator("#template");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("STANDARD");
    await expect(page.getByText("Scenes, captions, and your logo")).toBeVisible();

    await select.selectOption("LOWER_THIRD_PROMO");
    await expect(page.getByText(/animated banner slides in/i)).toBeVisible();

    await select.selectOption("WAVEFORM_CAPTIONS");
    await expect(page.getByText(/live waveform band reacts/i)).toBeVisible();

    await select.selectOption("STANDARD");
    await expect(page.getByText("Scenes, captions, and your logo")).toBeVisible();
  });
});

test.describe("AR / RTL", () => {
  test.use({ storageState: "playwright/.auth/ar.json" });

  test("Motion style hint updates as the template selection changes (Arabic)", async ({ page }) => {
    await page.goto("/studio/video");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const select = page.locator("#template");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("STANDARD");
    await expect(page.getByText("مشاهد وترجمة وشعارك")).toBeVisible();

    await select.selectOption("LOWER_THIRD_PROMO");
    await expect(page.getByText(/شريط متحرك ينزلق/)).toBeVisible();

    await select.selectOption("WAVEFORM_CAPTIONS");
    await expect(page.getByText(/شريط موجة صوتية حي/)).toBeVisible();
  });
});
