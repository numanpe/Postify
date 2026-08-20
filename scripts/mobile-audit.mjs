// Real-browser mobile-friendliness audit (Playwright + Chromium).
// Usage: node scripts/mobile-audit.mjs <email> <password>
//
// Checks, at small-phone (360px) / large-phone (428px) / tablet (768px):
// horizontal page overflow, and tap targets under ~40px on the smallest
// viewport. Fix findings, then re-run.
//
// Locale: this app's locale is Company.locale (see
// src/lib/i18n/get-locale.ts), not a runtime switch — there's no
// in-app language toggle to automate here, and this script
// deliberately doesn't ship a locale-flipping helper route (that would
// be an unauthenticated way to mutate any company's data). To audit
// Arabic/RTL, run this twice with two test accounts whose companies are
// already set to EN and AR respectively.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const [EMAIL, PASSWORD] = process.argv.slice(2);

const VIEWPORTS = [
  { name: "small-phone", width: 360, height: 800 },
  { name: "large-phone", width: 428, height: 926 },
  { name: "tablet", width: 768, height: 1024 },
];

const PAGES = [
  "/studio", "/poster", "/video", "/campaigns", "/repurpose",
  "/publish", "/media", "/brand-kit", "/settings",
];

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
}

async function checkPage(page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const smallTargets = [];
    if (winWidth <= 400) {
      for (const el of document.querySelectorAll("a, button")) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.height > 0 && rect.height < 40) {
          smallTargets.push({ tag: el.tagName, text: (el.textContent || "").trim().slice(0, 30), h: Math.round(rect.height) });
        }
      }
    }
    return { docWidth, winWidth, hasOverflow: docWidth > winWidth + 1, smallTargets };
  });
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("Usage: node scripts/mobile-audit.mjs <email> <password> [companyId]");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const results = [];

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE);
  await login(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const path of PAGES) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(200);
      results.push({ viewport: viewport.name, page: path, ...(await checkPage(page)) });
    }
  }
  await context.close();

  await browser.close();
  fs.writeFileSync("mobile-audit-results.json", JSON.stringify(results, null, 2));

  const overflowing = results.filter((r) => r.hasOverflow);
  const smallTaps = results.filter((r) => r.smallTargets.length > 0);
  console.log(`Checked ${results.length} page/viewport combinations.`);
  console.log(`Overflow: ${overflowing.length}. Small tap targets flagged: ${smallTaps.length}.`);
  for (const o of overflowing) console.log(`  OVERFLOW ${o.viewport}${o.page}: doc=${o.docWidth} win=${o.winWidth}`);
  for (const s of smallTaps) console.log(`  SMALL-TAP ${s.viewport}${s.page}:`, s.smallTargets);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
