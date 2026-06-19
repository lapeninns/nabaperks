import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const devOtpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
const webServerCommand = process.env.CI
  ? `CUSTOMER_DEV_OTP_CODE=${devOtpCode} pnpm build && CUSTOMER_DEV_OTP_CODE=${devOtpCode} pnpm start`
  : `CUSTOMER_DEV_OTP_CODE=${devOtpCode} pnpm dev`

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
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
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 240_000 : 120_000,
  },
})
