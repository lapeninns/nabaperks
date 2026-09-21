import { expect, test, type Page } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

/**
 * Numbers overview (handoff §6.3.1, §6.3.3, §7.4) on the DB-free harness.
 *
 * Range change via the sheet (URL round-trip), day selection by column and
 * by stepper with the polite readout, the low-data bands, zero activity,
 * and the partial-failure states.
 */

const readout = (page: Page) => page.locator("[data-numbers-readout]")
const chart = (page: Page, name: string) =>
  page.locator(`[data-column-chart="${name}"]`)

export function describeMerchantNumbers() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("full history: two charts, one selection, delta receipt in words", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoHydratedPage(page, HARNESS_ROUTES.numbers)

    await expect(page.locator("[data-numbers-headline]")).toContainText("81")
    await expect(page.locator("[data-numbers-headline]")).toContainText(
      "25 joined in the last 7 days"
    )
    await expect(chart(page, "stamps").getByRole("button")).toHaveCount(14)
    await expect(chart(page, "joins").getByRole("button")).toHaveCount(14)

    // Selection starts on the most recent day and both charts share it.
    const live = readout(page).locator("[aria-live=polite]")
    await expect(live).toContainText("Monday 21 September")
    await expect(live).toContainText("6 stamps · 4 joins")
    await expect(
      chart(page, "stamps").getByRole("button", {
        name: "Monday 21 September, 6 stamps",
      })
    ).toHaveAttribute("aria-current", "date")
    await expect(
      chart(page, "joins").getByRole("button", {
        name: "Monday 21 September, 4 joins",
      })
    ).toHaveAttribute("aria-current", "date")

    // Column shortcut on the joins chart moves the shared selection.
    await chart(page, "joins")
      .getByRole("button", { name: "Thursday 17 September, 4 joins" })
      .click()
    await expect(live).toContainText("Thursday 17 September")
    await expect(live).toContainText("6 stamps · 4 joins")
    await expect(
      chart(page, "stamps").getByRole("button", {
        name: "Thursday 17 September, 6 stamps",
      })
    ).toHaveAttribute("aria-current", "date")

    // Stepper is the 44px accessible path.
    const previous = readout(page).getByRole("button", { name: "Previous day" })
    const next = readout(page).getByRole("button", { name: "Next day" })
    expect((await previous.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await previous.click()
    await expect(live).toContainText("Wednesday 16 September")
    await next.click()
    await next.click()
    await expect(live).toContainText("Friday 18 September")

    // Delta receipt: glyph plus words, colour redundant.
    const deltas = page.locator("[data-numbers-deltas]")
    await expect(deltas).toContainText("same as last week")
    await expect(deltas).toContainText("8 fewer than last week")
    await expect(deltas).toContainText("7 fewer than last week")
    await expect(deltas).not.toContainText("vs last week")
    await expect(page.locator("[data-numbers-footnote]")).toContainText(
      "Europe/London"
    )
  })

  test("the range sheet round-trips through the URL and keeps 7 days", async ({
    page,
  }) => {
    await gotoHydratedPage(page, HARNESS_ROUTES.numbers)

    await page.locator("[data-numbers-range-trigger]").click()
    const sheet = page.locator("[data-numbers-range-sheet]")
    await expect(sheet).toBeVisible()
    await expect(
      sheet.getByRole("radio", { name: "Last 14 days" })
    ).toHaveAttribute("aria-checked", "true")
    await sheet.getByRole("radio", { name: "Last 7 days" }).click()
    await page.waitForURL((url) => url.searchParams.get("range") === "7")
    await expect(sheet).toBeHidden()
    await expect(chart(page, "stamps").getByRole("button")).toHaveCount(7)
    await expect(page.locator("[data-numbers-range-trigger]")).toHaveText(
      /Last 7 days/
    )
    await expect(readout(page).locator("[aria-live=polite]")).toContainText(
      "Monday 21 September"
    )
  })

  test("low-data bands: partial draws placeholders and suppresses deltas; early has no chart", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}?state=partial`)
    await expect(
      chart(page, "stamps").getByRole("button", { name: /not yet recorded$/ })
    ).toHaveCount(7)
    await expect(
      page.getByText("Dashed days: not yet recorded").first()
    ).toBeVisible()
    await expect(page.locator("[data-numbers-deltas]")).toContainText(
      "not enough history to compare yet"
    )
    // The stepper never lands on a placeholder day.
    const previous = readout(page).getByRole("button", { name: "Previous day" })
    // Six recorded days precede the newest; the seventh press finds the
    // control disabled at the placeholder boundary rather than a dashed day.
    for (let step = 0; step < 6; step += 1) await previous.click()
    await expect(readout(page).locator("[aria-live=polite]")).toContainText(
      "Tuesday 15 September"
    )
    await expect(previous).toBeDisabled()

    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}?state=early`)
    await expect(page.locator("[data-numbers-too-early]")).toContainText(
      "Come back on Wed 23 Sep"
    )
    await expect(page.locator("[data-column-chart]")).toHaveCount(0)
    await expect(page.locator("[data-numbers-too-early]")).toContainText("412")

    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}?state=never`)
    await expect(page.locator("[data-numbers-too-early]")).toContainText(
      "Your first stamp starts the clock."
    )
  })

  test("zero activity draws a labelled baseline, and partial failures keep the other half", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}?state=zero`)
    await expect(chart(page, "stamps")).toContainText("No stamps in this range")
    await expect(chart(page, "stamps").getByRole("button")).toHaveCount(14)

    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}?state=series-error`)
    await expect(page.locator("[data-numbers-series-error]")).toBeVisible()
    await expect(page.locator("[data-numbers-deltas]")).toBeVisible()
    await expect(page.locator("[data-column-chart]")).toHaveCount(0)

    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}?state=totals-error`)
    await expect(page.locator("[data-numbers-totals-error]")).toBeVisible()
    await expect(page.locator("[data-column-chart]")).toHaveCount(2)
    await expect(page.locator("[data-numbers-deltas]")).toHaveCount(0)

    await gotoHydratedPage(page, `${HARNESS_ROUTES.numbers}?state=both-error`)
    await expect(
      page.getByRole("heading", { name: "Could not load your numbers" })
    ).toBeVisible()
  })

  test("nothing clips at 320 and the delta rows read in greyscale", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await gotoHydratedPage(page, HARNESS_ROUTES.numbers)
    const overflow = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement
      const body = document.querySelector("[data-console-body]")!
      return Math.max(
        root.scrollWidth - root.clientWidth,
        body.scrollWidth - body.clientWidth
      )
    })
    expect(overflow).toBeLessThanOrEqual(0)

    // Direction survives without colour: glyph + words per row.
    const rows = page.locator("[data-numbers-deltas] dl > div")
    await expect(rows).toHaveCount(3)
    for (const text of await rows.allTextContents()) {
      expect(text).toMatch(/(▲|▼|=)\s*\d* ?(more|fewer|same|no activity)/)
    }
  })
}
