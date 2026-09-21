import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

/**
 * platform e2e harness H-5 (smoke).
 *
 * Proves Playwright boots the real Next app and the DB-free `/dev/app-harness`
 * surface renders end-to-end — the real `MerchantAppShell` + dashboard body fed
 * by static fixtures, no Supabase, no auth. If this is green the harness itself
 * works; every later domain spec hangs off it.
 */
test.describe("e2e harness smoke", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("dashboard harness lane renders the real merchant shell", async ({
    page,
  }) => {
    await page.goto(HARNESS_ROUTES.dashboard)

    // The shell's top bar names the seeded harness merchant
    // (app/dev/app-harness/fixtures.ts → HARNESS_MERCHANT.business_name).
    await expect(page.locator("[data-console-top-bar]")).toContainText(
      "Old Crown Girton"
    )

    // The Counter body: its landmark heading, the presentable QR card and
    // the pinned scanner.
    await expect(
      page.getByRole("heading", { level: 1, name: "Counter" })
    ).toHaveCount(1)
    await expect(
      page.getByRole("button", { name: /^QR code for .*Tap to present/ })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Scan a customer code" })
    ).toBeVisible()
  })

  test("design-system lane renders the Wet Ink catalog in dev", async ({
    page,
  }) => {
    const response = await page.goto(HARNESS_ROUTES.designSystem)

    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole("heading", { level: 1, name: "Design system catalog" })
    ).toBeVisible()
  })

  test("harness routes are dev-only (smoke navigation)", async ({ page }) => {
    const response = await page.goto(HARNESS_ROUTES.customers)
    expect(response?.status()).toBe(200)
  })
})
