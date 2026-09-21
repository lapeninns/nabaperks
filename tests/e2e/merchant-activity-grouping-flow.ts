import { expect, test } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

/** Activity grouping, scope and filters (handoff §6.2, §7.3) on the harness. */
export function describeMerchantActivityGrouping() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("runs of scans and joins collapse into details; rewards stay individual", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoHydratedPage(page, `${HARNESS_ROUTES.activity}?fixture=grouped`)

    const scans = page.locator('[data-activity-group="qr_scanned:today"]')
    await expect(scans).toBeVisible()
    await expect(scans).toContainText("4 QR scans")
    await expect(scans).toContainText("8 to 12 min ago")
    await expect(scans).not.toHaveAttribute("open", "")
    // Closed details keep their rows in the DOM; they must not be visible.
    await expect(
      scans.getByText("Someone scanned the QR", { exact: true }).first()
    ).toBeHidden()

    await scans.locator("summary").click()
    await expect(scans).toHaveAttribute("open", "")
    await expect(
      scans.getByText("Someone scanned the QR", { exact: true })
    ).toHaveCount(4)
    await expect(
      scans.getByText("Someone scanned the QR", { exact: true }).first()
    ).toBeVisible()

    const joins = page.locator(
      '[data-activity-group="customer_joined:yesterday"]'
    )
    await expect(joins).toContainText("3 joins")
    await joins.locator("summary").click()
    await expect(joins.getByRole("link", { name: "View member" })).toHaveCount(
      3
    )

    // The reward is its own card, with a person named on it.
    await expect(page.locator("[data-activity-group]")).toHaveCount(2)
    await expect(page.getByText(/redeemed/).first()).toBeVisible()
  })

  test("filter and scope round-trip through the URL and Load more keeps both", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.activity}?fixture=load-more`)

    await page
      .getByRole("group", { name: "Filter activity by type" })
      .getByRole("button", { name: "QR" })
      .click()
    await page.waitForURL((url) => url.searchParams.get("filter") === "qr")
    await page
      .getByRole("group", { name: "Activity range" })
      .getByRole("button", { name: "28 days" })
      .click()
    await page.waitForURL((url) => url.searchParams.get("range") === "28d")

    const loadMore = page.getByRole("link", { name: "Load more" })
    await expect(loadMore).toHaveAttribute("href", /filter=qr/)
    await expect(loadMore).toHaveAttribute("href", /range=28d/)
    await expect(loadMore).toHaveAttribute("href", /limit=50/)
  })

  test("one row: no grouping and no filter pills", async ({ page }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.activity}?fixture=single`)
    await expect(page.locator("[data-activity-group]")).toHaveCount(0)
    await expect(
      page.getByRole("group", { name: "Filter activity by type" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("group", { name: "Activity range" })
    ).toBeVisible()
  })

  test("every empty state names its cause", async ({ page }) => {
    await gotoHydratedPage(
      page,
      `${HARNESS_ROUTES.activity}?fixture=empty&filter=reward`
    )
    await expect(
      page.locator('[data-activity-empty="filtered"]')
    ).toContainText("No rewards activity in the last 7 days.")
    await page.getByRole("button", { name: "Clear filter" }).click()
    await page.waitForURL((url) => !url.searchParams.has("filter"))

    await gotoHydratedPage(
      page,
      `${HARNESS_ROUTES.activity}?fixture=empty&range=today`
    )
    await expect(page.locator('[data-activity-empty="today"]')).toContainText(
      "Nothing yet today."
    )
    await page.getByRole("button", { name: "See the last 7 days" }).click()
    await page.waitForURL((url) => !url.searchParams.has("range"))
    await expect(page.locator('[data-activity-empty="week"]')).toBeVisible()

    await gotoHydratedPage(
      page,
      `${HARNESS_ROUTES.activity}?fixture=empty&range=28d`
    )
    await expect(page.locator('[data-activity-empty="new"]')).toContainText(
      "The first scan of your QR lands here."
    )
  })
}
