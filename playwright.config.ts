import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright e2e harness.
 *
 * Restored from history (94f72d0b^) and reconciled to current `main`:
 * - `CUSTOMER_FLOW_DEV_HARNESS_ENABLED` is dropped — the `/dev` gate is now just
 *   `NODE_ENV !== "production"` (app/dev/layout.tsx), so dev mode alone enables
 *   the DB-free harness routes.
 * - `CUSTOMER_DEV_OTP_CODE=424242` stays — still read by lib/customer/*verification.
 *
 * Unit and contract tests stay on `node --test` (see package.json). Playwright
 * is the e2e runner ONLY; Vitest is intentionally not reintroduced.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"
const devOtpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
const visualPromoNow =
  process.env.PLAYWRIGHT_MARKETING_PROMO_NOW ?? "2026-07-06T12:00:00Z"
const authHookSecret = `v1,${"whsec"}_${"dGVzdC1ob29rLXNlY3JldA=="}`
// Known, distinct harness bearers so the cron and readiness gates can be
// exercised deterministically (see tests/e2e/cron-route-auth.spec.ts). These
// are throwaway e2e fixtures; production uses real secrets from the deployment
// environment. They must stay distinct so the readiness route proves it does
// not accept the cron secret.
const cronSecret = "pw-cron-secret-e2e-do-not-use-in-production"
const productionMonitorSecret = "pw-monitor-secret-e2e-do-not-use-in-production"
const devServerUrl = new URL(baseURL)
const devServerPort =
  devServerUrl.port || (devServerUrl.protocol === "https:" ? "443" : "80")
const task21Matrix = process.env.TASK21_PLAYWRIGHT_MATRIX === "1"
const task21ReadyPort = Number(devServerPort) + 10_000
if (
  task21Matrix &&
  (!Number.isInteger(task21ReadyPort) ||
    Number(devServerPort) < 1024 ||
    task21ReadyPort > 65_535)
) {
  throw new Error("Invalid Task21 Playwright base port")
}
const devServerReadyUrl = task21Matrix
  ? `http://127.0.0.1:${task21ReadyPort}/task21-ready`
  : new URL("/signup", devServerUrl).toString()
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
  `CRON_SECRET=${cronSecret}`,
  `PRODUCTION_MONITOR_SECRET=${productionMonitorSecret}`,
].join(" ")
const devServerCommand = task21Matrix
  ? `${devServerEnv} TASK21_PLAYWRIGHT_READY_PORT=${task21ReadyPort} node tests/support/task21-playwright-server-supervisor.mjs`
  : `${devServerEnv} pnpm exec next dev --webpack`
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
const chromiumChannel =
  process.env.PLAYWRIGHT_REGULAR_CHROMIUM === "1" ? "chromium" : undefined
const task15OutputNamespace = process.env.TASK15_PLAYWRIGHT_OUTPUT_NAMESPACE
if (
  task15OutputNamespace !== undefined &&
  !/^task15-mobile-safari-\d+$/.test(task15OutputNamespace)
) {
  throw new Error("Invalid Task 15 Playwright output namespace")
}

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir:
    task15OutputNamespace === undefined
      ? undefined
      : `test-results/${task15OutputNamespace}`,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/playwright-results.json" }],
  ],
  timeout: 180_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  ...(task21Matrix ? { retries: 0 } : {}),
  workers: localWorkers,
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
        // Functional and accessibility CI opt into regular Chromium's new
        // headless mode. Visual CI stays on the baseline-generating shell.
        channel: chromiumChannel,
      },
    },
    {
      name: "tablet",
      testMatch: "**/visual-layout-invariants/visual.spec.ts",
      use: {
        ...devices["iPad (gen 7)"],
      },
    },
    {
      name: "mobile-landscape",
      testMatch: "**/visual-layout-invariants/visual.spec.ts",
      use: {
        ...devices["iPhone 14"],
        viewport: { width: 812, height: 375 },
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
    command: devServerCommand,
    url: devServerReadyUrl,
    reuseExistingServer,
    ...(task21Matrix
      ? { gracefulShutdown: { signal: "SIGTERM" as const, timeout: 5_000 } }
      : {}),
    timeout: process.env.CI ? 180_000 : 120_000,
  },
})
