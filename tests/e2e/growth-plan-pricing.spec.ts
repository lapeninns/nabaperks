import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * Growth Plan pricing sheet — mobile responsive proof (runs on the
 * mobile-safari project). The sheet must keep ONE unmistakable outer
 * boundary while the two payment schedules stack vertically, with no
 * clipped prices, no horizontal overflow, and 44px+ interactive targets
 * down to a 320px viewport.
 */
test.describe("Growth Plan pricing sheet @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
    await page.setViewportSize({ width: 320, height: 812 })
    await page.goto("/pricing")
  })

  test("Given a 320px viewport When the sheet renders Then the schedules stack inside one boundary without overflow", async ({
    page,
  }) => {
    const sheet = page.locator("[data-growth-plan-pricing]")
    await expect(sheet).toHaveCount(1)
    await expect(sheet).toBeVisible()

    const payAsYouGo = page.locator('[data-payment-option="28-day"]')
    const annual = page.locator('[data-payment-option="annual"]')
    await expect(payAsYouGo).toBeVisible()
    await expect(annual).toBeVisible()

    // Stacked: the annual option sits fully below the 28-day option.
    const paygBox = await payAsYouGo.boundingBox()
    const annualBox = await annual.boundingBox()
    if (!paygBox || !annualBox) {
      throw new Error("payment option boxes must be measurable")
    }
    expect(annualBox.y).toBeGreaterThanOrEqual(
      paygBox.y + paygBox.height - 4
    )

    // Ticket-style prices render and are never clipped.
    await expect(page.getByText("£299.99", { exact: true })).toBeVisible()
    await expect(page.getByText("£69.99", { exact: true })).toBeVisible()
    await expect(page.getByText("£699.90", { exact: true })).toBeVisible()
    for (const option of [payAsYouGo, annual]) {
      expect(
        await option.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1
        )
      ).toBe(true)
    }

    // One shared feature list and one shared CTA inside the sheet.
    await expect(
      sheet.getByText("Both choices include the same Growth Plan", {
        exact: false,
      })
    ).toHaveCount(1)
    const cta = sheet.getByRole("link", { name: "Start your launch" })
    await expect(cta).toHaveCount(1)
    const ctaBox = await cta.boundingBox()
    if (!ctaBox) throw new Error("the shared CTA must be measurable")
    expect(ctaBox.height).toBeGreaterThanOrEqual(44)

    // The takeover enquiry renders OUTSIDE (below) the Growth Plan boundary.
    const takeover = page.locator("[data-takeover-enquiry]")
    await expect(takeover).toHaveCount(1)
    const sheetBox = await sheet.boundingBox()
    const takeoverBox = await takeover.boundingBox()
    if (!sheetBox || !takeoverBox) {
      throw new Error("sheet and takeover boxes must be measurable")
    }
    expect(takeoverBox.y).toBeGreaterThanOrEqual(
      sheetBox.y + sheetBox.height - 1
    )
    const takeoverButton = takeover.getByRole("link", {
      name: "Discuss a bespoke takeover",
    })
    const takeoverButtonBox = await takeoverButton.boundingBox()
    if (!takeoverButtonBox) {
      throw new Error("the takeover enquiry button must be measurable")
    }
    expect(takeoverButtonBox.height).toBeGreaterThanOrEqual(44)

    // No horizontal overflow at 320px.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
