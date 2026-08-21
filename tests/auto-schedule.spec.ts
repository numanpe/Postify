import { test, expect } from "@playwright/test";

// Task 5 verification: the seeded E2E companies have no PublishJob/
// EngagementSnapshot history, so this exercises the real "default"
// path (UAE/GCC static peak hour) end-to-end through an actual click
// in a real browser. The "learned" path (enough real engagement data
// to override the default) was verified directly against
// computePeakPublishHour/suggestPeakPublishTime with real seeded
// PublishJob + EngagementSnapshot rows via a temporary route during
// implementation — not re-verified here since this test's job is the
// UI wiring, not the scheduling math itself.

test.describe("EN / LTR", () => {
  test.use({ storageState: "playwright/.auth/en.json" });

  test("Auto-Schedule Peak Time fills the datetime field with a real future value", async ({ page }) => {
    await page.goto("/publish");

    const scheduledForInput = page.locator("#scheduledFor");
    await expect(scheduledForInput).toBeVisible();
    await expect(scheduledForInput).toHaveValue("");

    const autoScheduleBtn = page.getByRole("button", { name: "Auto-Schedule Peak Time" });
    await expect(autoScheduleBtn).toBeVisible();
    await autoScheduleBtn.click();

    // Real server round trip, not instant — wait for a real value.
    await expect(scheduledForInput).not.toHaveValue("", { timeout: 10_000 });

    const value = await scheduledForInput.inputValue();
    const scheduled = new Date(value);
    expect(scheduled.getTime()).toBeGreaterThan(Date.now());

    await expect(page.getByText(/typical GCC peak-engagement hour/i)).toBeVisible();
  });
});

test.describe("AR / RTL", () => {
  test.use({ storageState: "playwright/.auth/ar.json" });

  test("Auto-Schedule Peak Time works in Arabic and fills a real future value", async ({ page }) => {
    await page.goto("/publish");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const scheduledForInput = page.locator("#scheduledFor");
    await expect(scheduledForInput).toBeVisible();

    const autoScheduleBtn = page.getByRole("button", { name: "جدولة تلقائية لوقت الذروة" });
    await expect(autoScheduleBtn).toBeVisible();
    await autoScheduleBtn.click();

    await expect(scheduledForInput).not.toHaveValue("", { timeout: 10_000 });
    const value = await scheduledForInput.inputValue();
    expect(new Date(value).getTime()).toBeGreaterThan(Date.now());

    await expect(page.getByText(/ساعة ذروة تفاعل نموذجية/)).toBeVisible();
  });
});
