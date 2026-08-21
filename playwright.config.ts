import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // shared seeded DB rows across the suite — no per-test isolation
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: /.*\.spec\.ts/,
      testIgnore: /mobile-responsiveness\.spec\.ts/,
    },
    // Real device emulation (viewport, touch, UA) — mobile-responsiveness.spec.ts
    // only, so the desktop-oriented specs above aren't redundantly
    // re-run at a mobile viewport where their selectors weren't
    // written to account for it.
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 13"] },
      dependencies: ["setup"],
      testMatch: /mobile-responsiveness\.spec\.ts/,
    },
    {
      name: "mobile-pixel",
      use: { ...devices["Pixel 6"] },
      dependencies: ["setup"],
      testMatch: /mobile-responsiveness\.spec\.ts/,
    },
  ],
});
