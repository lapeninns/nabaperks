import { expect, test } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

/** Numbers metric detail (handoff §6.3.2, §7.4) on the DB-free harness. */
export function describeMerchantNumbersDetail() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("the overview's delta rows open the metric detail", async ({ page }) => {
    await gotoHydratedPage(page, HARNESS_ROUTES.numbers)
    await page.locator('[data-numbers-metric-link="stamps"]').click()
    await page.waitForURL((url) => url.pathname.endsWith("/numbers/stamps"))
    await expect(page.locator("[data-numbers-detail-headline]")).toContainText(
      "stamps in the last 14 days"
    )

    // The chosen range travels into the detail link.
    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}?range=7`)
    await page.locator('[data-numbers-metric-link="rewards"]').click()
    await page.waitForURL((url) => url.searchParams.get("range") === "7")
    await expect(page.locator("[data-numbers-detail-headline]")).toContainText(
      "rewards unlocked in the last 7 days"
    )
  })

  test("stamps detail: range total, own chart, comparison in words, best and quietest day, recent rows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}/stamps?range=7`)

    const headline = page.locator("[data-numbers-detail-headline]")
    await expect(headline).toContainText("51")
    await expect(headline).toContainText("stamps in the last 7 days")
    await expect(
      page.locator('[data-column-chart="stamps"]').getByRole("button")
    ).toHaveCount(7)
    await expect(page.locator("[data-numbers-comparison]")).toContainText(
      "8 fewer than last week"
    )
    const bestQuiet = page.locator("[data-numbers-best-quiet]")
    await expect(bestQuiet).toContainText("Friday 18 September")
    await expect(bestQuiet).toContainText("Thursday 17 September")
    await expect(
      page
        .locator("[data-numbers-recent]")
        .getByRole("link", { name: "All in Activity" })
    ).toHaveAttribute("href", /filter=stamp$/)

    await page
      .locator('[data-column-chart="stamps"]')
      .getByRole("button", { name: "Wednesday 16 September, 8 stamps" })
      .click()
    const readout = page.locator("[data-numbers-readout]")
    await expect(readout).toContainText("Wednesday 16 September")
    await readout.getByRole("button", { name: "Next day" }).click()
    await expect(readout).toContainText("Thursday 17 September")
  })

  test("QR has no daily series: total and comparison only, no chart and no range control", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}/qr`)
    await expect(page.locator("[data-numbers-detail-headline]")).toContainText(
      "QR downloads, all time"
    )
    await expect(page.locator("[data-column-chart]")).toHaveCount(0)
    await expect(page.locator("[data-numbers-range-trigger]")).toHaveCount(0)
    await expect(page.locator("[data-numbers-comparison]")).toContainText(
      "no activity either week"
    )
  })

  test("partial and early bands, series failure, and an unknown metric", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      `${HARNESS_ROUTES.numbers}/rewards?state=partial`
    )
    await expect(page.locator("[data-numbers-comparison]")).toContainText(
      "not enough history to compare yet"
    )
    await expect(
      page
        .locator('[data-column-chart="rewards unlocked"]')
        .getByRole("button", {
          name: /not yet recorded$/,
        })
    ).toHaveCount(7)

    await gotoHydratedPage(
      page,
      `${HARNESS_ROUTES.numbers}/members?state=early`
    )
    await expect(page.locator("[data-numbers-too-early]")).toBeVisible()
    await expect(page.locator("[data-column-chart]")).toHaveCount(0)

    await gotoHydratedPage(
      page,
      `${HARNESS_ROUTES.numbers}/stamps?state=series-error`
    )
    await expect(page.locator("[data-numbers-series-error]")).toBeVisible()
    await expect(page.locator("[data-numbers-comparison]")).toBeVisible()

    const response = await page.goto(`${HARNESS_ROUTES.numbers}/revenue`)
    expect(response?.status()).toBe(404)
  })
}
