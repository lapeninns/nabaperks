import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const devOtpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
const devServerUrl = new URL(baseURL)
const devServerPort =
  devServerUrl.port || (devServerUrl.protocol === "https:" ? "443" : "80")

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "iphone-customer-flow",
      // The merchant pin-map proof is a desktop scenario; keep it out of the
      // mobile customer-flow project so existing captures stay iPhone-only.
      testIgnore: "**/high-accuracy-geofence-precision.spec.ts",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
      },
    },
    {
      name: "chromium",
      testMatch: "**/high-accuracy-geofence-precision.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: `PORT=${devServerPort} CUSTOMER_DEV_OTP_CODE=${devOtpCode} pnpm dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 180_000 : 120_000,
  },
})
