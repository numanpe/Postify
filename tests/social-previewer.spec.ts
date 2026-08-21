import { test, expect } from "@playwright/test";

// Task 4 verification: real client-side interaction (dialog open/close,
// tab switching) that couldn't be checked earlier in this session
// because no browser was connected. Real routes and real locale
// mechanism, not the originally-sketched /studio?lang=ar + manual
// dir="rtl" override — this app's locale is Company.locale in the DB
// (see src/lib/i18n/get-locale.ts), so the AR case logs in as a
// genuinely AR-locale seeded company (global-setup.ts) and asserts the
// real Arabic dictionary strings, not an English fallback regex.

test.describe("EN / LTR", () => {
  test.use({ storageState: "playwright/.auth/en.json" });

  test("Preview modal opens, platform tabs switch, and modal closes", async ({ page }) => {
    await page.goto("/studio/poster");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    const previewBtn = page.getByRole("button", { name: "Preview" }).first();
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Preview on Social Media");
    await expect(modal).toContainText(/preview only/i);

    const platforms = ["Instagram", "Facebook", "LinkedIn", "TikTok"];
    for (const platform of platforms) {
      const tab = page.getByRole("tab", { name: platform });
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      // Every other tab in the same tablist must not also claim selected.
      for (const other of platforms.filter((p) => p !== platform)) {
        await expect(page.getByRole("tab", { name: other })).toHaveAttribute("aria-selected", "false");
      }
    }

    const closeBtn = modal.getByRole("button", { name: "Close" });
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});

test.describe("AR / RTL", () => {
  test.use({ storageState: "playwright/.auth/ar.json" });

  test("Preview modal opens, platform tabs switch, and modal closes (Arabic)", async ({ page }) => {
    await page.goto("/studio/poster");
    // Real server-rendered RTL — Company.locale = "AR" drives
    // src/app/layout.tsx's dir attribute; nothing client-side forces it.
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const previewBtn = page.getByRole("button", { name: "معاينة" }).first();
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("معاينة على وسائل التواصل الاجتماعي");
    await expect(modal).toContainText("معاينة بصرية فقط");

    const platforms = ["إنستغرام", "فيسبوك", "لينكدإن", "تيك توك"];
    for (const platform of platforms) {
      const tab = page.getByRole("tab", { name: platform });
      await expect(tab).toBeVisible();
      // RTL layout must not clip the tab out of the viewport.
      await expect(tab).toBeInViewport();
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
    }

    const closeBtn = modal.getByRole("button", { name: "إغلاق" });
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
