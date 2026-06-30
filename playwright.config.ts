import { defineConfig, devices } from "@playwright/test"

const port = process.env.NABAPERKS_E2E_PORT ?? "3100"
const suppliedBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const baseURL = suppliedBaseUrl ?? `http://127.0.0.1:${port}`
const webServer = suppliedBaseUrl
  ? undefined
  : {
      command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: baseURL,
    }

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: "test-results/playwright",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer,
})
