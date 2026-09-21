import { expect, test } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

/** More (handoff §6.4, §7.5) on the DB-free harness. */
export function describeMerchantMore() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("phone: six rows with live subtitles, 58px targets, More tab active", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoHydratedPage(page, HARNESS_ROUTES.more)

    const rows = page.locator("[data-more-row]")
    await expect(rows).toHaveCount(5)
    await expect(page.locator('[data-more-row="poster"]')).toContainText(
      "Printed"
    )
    await expect(page.locator('[data-more-row="members"]')).toContainText(
      "1,842 on the card"
    )
    await expect(page.locator('[data-more-row="offers"]')).toContainText(
      "Two-stamp Tuesday"
    )
    await expect(page.locator('[data-more-row="announce"]')).toContainText(
      "Last sent Sat 19 Sep"
    )
    await expect(page.locator('[data-more-row="setup"]')).toHaveCount(0)
    await expect(page.locator('[data-more-row="account"]')).toContainText(
      "Billing active"
    )
    for (const row of await rows.all()) {
      expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(58)
    }
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible()
    await expect(
      page
        .locator('nav[aria-label="Console"][data-console-nav="tabs"]')
        .getByRole("link", { name: "More" })
    ).toHaveAttribute("aria-current", "page")
  })

  test("setup incomplete shows steps left; failed subtitles still navigate; trial chip", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      `${HARNESS_ROUTES.more}?state=setup-incomplete`
    )
    await expect(page.locator('[data-more-row="setup"]')).toContainText(
      "2 of 5 steps left"
    )
    await expect(page.locator('[data-more-row="poster"]')).toContainText(
      "Not yet printed"
    )
    await expect(page.locator('[data-more-row="offers"]')).toContainText(
      "None running"
    )

    await gotoHydratedPage(
      page,
      `${HARNESS_ROUTES.more}?state=subtitles-failed`
    )
    await expect(page.locator("[data-more-subtitle]")).toHaveCount(0)
    await expect(page.locator('[data-more-row="members"]')).toHaveAttribute(
      "href",
      "/app/customers"
    )

    await gotoHydratedPage(page, `${HARNESS_ROUTES.more}?state=trial`)
    await expect(page.locator('[data-more-row="account"]')).toContainText(
      "12 days left"
    )

    await gotoHydratedPage(page, `${HARNESS_ROUTES.more}?state=logout-pending`)
    await expect(
      page.getByRole("button", { name: /Logging out/ })
    ).toBeDisabled()
  })

  test("from 900px More redirects to the console root", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 })
    await gotoHydratedPage(page, `${HARNESS_ROUTES.more}?redirect=1`)
    await page.waitForURL((url) => url.pathname === HARNESS_ROUTES.dashboard)

    await page.setViewportSize({ width: 390, height: 844 })
    await gotoHydratedPage(page, `${HARNESS_ROUTES.more}?redirect=1`)
    await expect(page.locator("[data-more-list]")).toBeVisible()
    expect(new URL(page.url()).pathname).toBe(HARNESS_ROUTES.more)
  })
}
