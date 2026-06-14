import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const devOtpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
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
    command: `CUSTOMER_DEV_OTP_CODE=${devOtpCode} pnpm dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
