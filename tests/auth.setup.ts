import { test as setup, expect } from "@playwright/test";

import { EN_USER, AR_USER } from "./seed-data";

const EN_AUTH_FILE = "playwright/.auth/en.json";
const AR_AUTH_FILE = "playwright/.auth/ar.json";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  // requireCompany() sends an authenticated user with a company past
  // /auth/login — real redirect, not a fake wait.
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 15_000 });
}

setup("authenticate as EN test user", async ({ page }) => {
  await login(page, EN_USER.email, EN_USER.password);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.context().storageState({ path: EN_AUTH_FILE });
});

setup("authenticate as AR test user", async ({ page }) => {
  await login(page, AR_USER.email, AR_USER.password);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.context().storageState({ path: AR_AUTH_FILE });
});
