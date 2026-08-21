import { test, expect } from "@playwright/test";

// Real device-emulated (viewport + touch + UA, via playwright.config.ts's
// mobile-iphone/mobile-pixel projects) verification of the mobile nav
// restructure, touch targets, bottom-sheet anchoring, and RTL layout —
// not just class-name inspection. Reuses the same EN/AR seeded
// companies + storageState as the rest of the suite (global-setup.ts);
// the seeded poster is what makes /studio/poster's real
// SocialPreviewModal trigger available.

test.describe("EN / LTR", () => {
  test.use({ storageState: "playwright/.auth/en.json" });

  test("Bottom nav replaces the desktop nav below md:, with real 48px touch targets", async ({ page }) => {
    await page.goto("/media");

    const bottomNav = page.getByRole("navigation", { name: "Menu" });
    await expect(bottomNav).toBeVisible();

    // AppNav's desktop row is `hidden md:flex` — genuinely not in the
    // accessibility tree as visible at a mobile viewport, not just
    // visually hidden.
    const desktopNav = page.locator("header nav").filter({ hasText: "Create Content" });
    await expect(desktopNav).toBeHidden();

    const navLinks = bottomNav.locator("a, button");
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
  });

  test("No horizontal page overflow at mobile viewport", async ({ page }) => {
    await page.goto("/media");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1); // 1px tolerance for subpixel rounding
  });

  test("Text inputs render at >=16px to avoid iOS auto-zoom", async ({ page }) => {
    await page.goto("/brand-kit");
    const urlInput = page.locator('input[name="websiteUrl"]');
    await expect(urlInput).toBeVisible();
    const fontSize = await urlInput.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test("Bottom sheet anchors to the real bottom edge of the viewport", async ({ page }) => {
    await page.goto("/studio/poster");
    const previewBtn = page.getByRole("button", { name: "Preview" }).first();
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    // Bottom-anchored means the sheet's bottom edge sits at (or very
    // near) the viewport's bottom edge — a centered modal would not.
    expect(box!.y + box!.height).toBeGreaterThan(viewport!.height - 10);
  });
});

test.describe("AR / RTL", () => {
  test.use({ storageState: "playwright/.auth/ar.json" });

  test("Bottom nav and RTL layout both work together, no overflow", async ({ page }) => {
    await page.goto("/media");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const bottomNav = page.getByRole("navigation", { name: "القائمة" });
    await expect(bottomNav).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("Social previewer's scroll-snap tabs don't cause page overflow in RTL", async ({ page }) => {
    await page.goto("/studio/poster");
    const previewBtn = page.getByRole("button", { name: "معاينة" }).first();
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("tab", { name: "إنستغرام" })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
