import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

/**
 * Growth Plan pricing sheet — desktop proof (chromium, firefox, safari
 * projects). The two payment schedules stack inside the single
 * Growth Plan boundary, the takeover stays a subordinate enquiry outside
 * it, and the sheet passes the WCAG 2 A/AA axe sweep.
 */
test.describe("Growth Plan pricing sheet @desktop", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
    await page.goto("/pricing")
  })

  test("Given a desktop viewport When the sheet renders Then the schedules stack inside one boundary and the page passes axe", async ({
    page,
  }) => {
    const sheet = page.locator("[data-growth-plan-pricing]")
    await expect(sheet).toHaveCount(1)
    await expect(sheet).toBeVisible()

    const payAsYouGo = page.locator('[data-payment-option="28-day"]')
    const annual = page.locator('[data-payment-option="annual"]')

    // Asymmetric hierarchy: the recurring price leads, the annual schedule
    // sits beneath it. Two equal columns read as a spec table, so the annual
    // lockup is deliberately subordinate rather than side by side.
    const paygBox = await payAsYouGo.boundingBox()
    const annualBox = await annual.boundingBox()
    if (!paygBox || !annualBox) {
      throw new Error("payment option boxes must be measurable")
    }
    expect(annualBox.y).toBeGreaterThanOrEqual(paygBox.y + paygBox.height - 1)

    // Both schedules live INSIDE the one Growth Plan boundary.
    const sheetBox = await sheet.boundingBox()
    if (!sheetBox) throw new Error("the sheet box must be measurable")
    for (const box of [paygBox, annualBox]) {
      expect(box.y).toBeGreaterThanOrEqual(sheetBox.y)
      expect(box.y + box.height).toBeLessThanOrEqual(
        sheetBox.y + sheetBox.height + 1
      )
    }

    // One shared CTA; the takeover enquiry stays outside the sheet.
    await expect(
      sheet.getByRole("link", { name: "Start your launch" })
    ).toHaveCount(1)
    const takeover = page.locator("[data-takeover-enquiry]")
    await expect(takeover).toHaveCount(1)
    const takeoverBox = await takeover.boundingBox()
    if (!takeoverBox) throw new Error("the takeover box must be measurable")
    expect(takeoverBox.y).toBeGreaterThanOrEqual(
      sheetBox.y + sheetBox.height - 1
    )

    // No horizontal overflow on desktop widths either.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)

    await expectNoAxeViolations(page, "Growth Plan pricing sheet")
  })
})
