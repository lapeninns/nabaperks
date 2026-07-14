import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright e2e harness (MS-platform-e2e-harness).
 *
 * Restored from history (94f72d0b^) and reconciled to current `main`:
 * - `CUSTOMER_FLOW_DEV_HARNESS_ENABLED` is dropped — the `/dev` gate is now just
 *   `NODE_ENV !== "production"` (app/dev/layout.tsx), so dev mode alone enables
 *   the DB-free harness routes.
 * - `CUSTOMER_DEV_OTP_CODE=424242` stays — still read by lib/customer/*verification.
 *
 * Unit + micro-spec tests stay on `node --test` (see package.json). Playwright
 * is the e2e runner ONLY; Vitest is intentionally not reintroduced.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"
const devOtpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
const visualPromoNow =
  process.env.PLAYWRIGHT_MARKETING_PROMO_NOW ?? "2026-07-06T12:00:00Z"
const authHookSecret = `v1,${"whsec"}_${"dGVzdC1ob29rLXNlY3JldA=="}`
const devServerUrl = new URL(baseURL)
const devServerPort =
  devServerUrl.port || (devServerUrl.protocol === "https:" ? "443" : "80")
const devServerEnv = [
  `PORT=${devServerPort}`,
  `CUSTOMER_DEV_OTP_CODE=${devOtpCode}`,
  `PLAYWRIGHT_MARKETING_PROMO_NOW=${visualPromoNow}`,
  "PLAYWRIGHT_HARNESS=1",
  `SUPABASE_SEND_EMAIL_HOOK_SECRET=${authHookSecret}`,
  `SUPABASE_SEND_SMS_HOOK_SECRET=${authHookSecret}`,
  "RESEND_API_KEY=re_playwright_harness",
  "RESEND_FROM=",
  "TWILIO_MESSAGING_SERVICE_SID=",
].join(" ")
const localWorkerOverride = process.env.PLAYWRIGHT_WORKERS
  ? Number.parseInt(process.env.PLAYWRIGHT_WORKERS, 10)
  : 1
const localWorkers =
  Number.isFinite(localWorkerOverride) && localWorkerOverride > 0
    ? localWorkerOverride
    : 1
const snapshotPathTemplate =
  "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}"
const ciLinuxSnapshotPathTemplate =
  process.env.CI && process.platform === "linux"
    ? "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-linux{ext}"
    : undefined
const reuseExistingServer =
  !process.env.CI && process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : localWorkers,
  expect: {
    timeout: 15_000,
  },
  snapshotPathTemplate,
  use: {
    baseURL,
    contextOptions: {
      reducedMotion: "reduce",
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-safari",
      snapshotPathTemplate: ciLinuxSnapshotPathTemplate,
      // Desktop-only scenarios (e.g. the merchant pin-map proof) opt out of the
      // mobile project via `testIgnore` so mobile captures stay iPhone-only.
      testIgnore: "**/*.desktop.spec.ts",
      use: {
        ...devices["iPhone 14"],
      },
    },
    {
      name: "chromium",
      snapshotPathTemplate: ciLinuxSnapshotPathTemplate,
      testMatch: ["**/*.desktop.spec.ts", "**/visual.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "desktop-firefox",
      snapshotPathTemplate: ciLinuxSnapshotPathTemplate,
      testMatch: ["**/*.desktop.spec.ts", "**/visual.spec.ts"],
      use: {
        ...devices["Desktop Firefox"],
      },
    },
    {
      name: "desktop-safari",
      snapshotPathTemplate: ciLinuxSnapshotPathTemplate,
      testMatch: ["**/*.desktop.spec.ts", "**/visual.spec.ts"],
      use: {
        ...devices["Desktop Safari"],
      },
    },
  ],
  webServer: {
    command: `${devServerEnv} pnpm exec next dev --webpack`,
    url: baseURL,
    reuseExistingServer,
    timeout: process.env.CI ? 180_000 : 120_000,
  },
})
