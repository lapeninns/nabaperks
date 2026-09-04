import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

/**
 * Growth Plan pricing sheet — desktop proof (chromium, firefox, safari
 * projects). The two payment rhythms sit as peer columns inside the single
 * Growth Plan boundary, the takeover stays a subordinate enquiry outside
 * it, and the sheet passes the WCAG 2 A/AA axe sweep.
 */
test.describe("Growth Plan pricing sheet @desktop", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
    await page.goto("/pricing")
  })

  test("Given a desktop viewport When the sheet renders Then the rhythms sit as peers inside one boundary and the page passes axe", async ({
    page,
  }) => {
    const campaign = page.getByLabel("Current seasonal offer")
    await expect(campaign).toContainText("The Autumn First-Regular Launch")
    await expect(campaign).toContainText(
      "Join the autumn launch cohort by 30 September 2026."
    )

    const sheet = page.locator("[data-growth-plan-pricing]")
    await expect(sheet).toHaveCount(1)
    await expect(sheet).toBeVisible()

    const payAsYouGo = page.locator('[data-payment-option="28-day"]')
    const annual = page.locator('[data-payment-option="annual"]')

    // Peer rhythms: from the marketing lg breakpoint the two cadences sit
    // side by side. They are not plan tiers.
    const paygBox = await payAsYouGo.boundingBox()
    const annualBox = await annual.boundingBox()
    if (!paygBox || !annualBox) {
      throw new Error("payment option boxes must be measurable")
    }
    expect(annualBox.x).toBeGreaterThan(paygBox.x + paygBox.width / 2)
    expect(Math.abs(annualBox.y - paygBox.y)).toBeLessThan(paygBox.height)

    // Both schedules live INSIDE the one Growth Plan boundary.
    const sheetBox = await sheet.boundingBox()
    if (!sheetBox) throw new Error("the sheet box must be measurable")
    for (const box of [paygBox, annualBox]) {
      expect(box.y).toBeGreaterThanOrEqual(sheetBox.y)
      expect(box.y + box.height).toBeLessThanOrEqual(
        sheetBox.y + sheetBox.height + 1
      )
    }

    // A launch CTA on the 28-day card and in the includes sheet; annual
    // uses its own label. The takeover enquiry stays outside the sheet.
    await expect(
      sheet.getByRole("link", { name: "Start your launch" })
    ).toHaveCount(2)
    await expect(
      sheet.getByRole("link", { name: "Prepay a year", exact: true })
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

    const firstFaqSummary = page.locator("#pricing-faq summary").first()
    await firstFaqSummary.focus()
    await expect(firstFaqSummary).toBeFocused()
    const focusStyle = await firstFaqSummary.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      }
    })
    expect(focusStyle.outlineStyle).not.toBe("none")
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2)

    await expectNoAxeViolations(page, "Growth Plan pricing sheet")
  })
})
