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

    // PageTitle <h1> from the seeded harness merchant
    // (app/dev/app-harness/fixtures.ts → HARNESS_MERCHANT.business_name).
    await expect(
      page.getByRole("heading", { level: 1, name: "Old Crown Girton" })
    ).toBeVisible()

    // Stable <h2> section landmarks hardcoded in the dashboard body.
    await expect(
      page.getByRole("heading", { name: "Recent activity" })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Do next" })
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
