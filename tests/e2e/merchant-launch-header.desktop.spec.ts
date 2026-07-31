import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

/**
 * Merchant launch-header interaction hierarchy (@launch-header) — DB-free
 * harness tier, DESKTOP projects only (`.desktop.spec.ts`).
 *
 * The launch header is descriptive only. Setup actions live after the active
 * panel in one sequential footer, so the header never competes with the active
 * panel's primary action. The `?state=` selector drives the DB-free state.
 *
 * The pure decision behind this is unit-tested in
 * tests/unit/launch-header-copy; these assert it actually renders that way.
 */
test.describe("merchant launch header @launch-header", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("needsBilling: the header stays descriptive while the footer advances to card", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=billing&tab=venue`)

    await expect(
      page.getByRole("link", { name: "Proceed to billing" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Card", exact: true })
    ).toHaveAttribute("href", "/app/launch?tab=card")
  })

  test("needsBilling: the header CTA is suppressed on the billing tab", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=billing&tab=billing`)

    await expect(
      page.getByRole("link", { name: "Proceed to billing" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", {
        name: /Continue.*£299\.99.*£69\.99.*28 days/i,
      })
    ).toBeVisible()
    await expect(page.getByText("Next step", { exact: true })).toHaveCount(0)
  })

  test("needsQr: the billing footer advances to the venue QR", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=qr&tab=billing`)

    await expect(page.getByRole("link", { name: "Open venue QR" })).toHaveCount(
      0
    )
    await expect(
      page.getByRole("link", { name: "Venue QR", exact: true })
    ).toHaveAttribute("href", "/app/launch?tab=qr")
  })

  test("launchReady: an earlier tab still advances sequentially", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=live&tab=venue`)

    await expect(page.getByRole("link", { name: "Open venue QR" })).toHaveCount(
      0
    )
    await expect(
      page.getByRole("link", { name: "Card", exact: true })
    ).toHaveAttribute("href", "/app/launch?tab=card")
  })

  test("launchReady: the QR footer advances to the dashboard", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=live&tab=qr`)

    await expect(page.getByRole("link", { name: "Open venue QR" })).toHaveCount(
      0
    )
    await expect(
      page.getByRole("main").getByRole("link", { name: "Dashboard" })
    ).toHaveAttribute("href", "/app")
  })
})
