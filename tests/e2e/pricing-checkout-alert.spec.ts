import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

test.describe("pricing checkout return alert", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("shows the success alert when Stripe returns with checkout=success", async ({
    page,
  }) => {
    // Given / When
    await page.goto("/pricing?checkout=success")
    const checkoutAlert = page.locator('[data-slot="alert"][role="alert"]')

    // Then
    await expect(checkoutAlert).toContainText("Checkout complete")
    await expect(checkoutAlert).toContainText(
      "Your Growth Plan setup can continue from the merchant billing page."
    )
  })

  test("shows the cancelled alert when Stripe returns with checkout=cancelled", async ({
    page,
  }) => {
    // Given / When
    await page.goto("/pricing?checkout=cancelled")
    const checkoutAlert = page.locator('[data-slot="alert"][role="alert"]')

    // Then
    await expect(checkoutAlert).toContainText("Checkout cancelled")
    await expect(checkoutAlert).toContainText(
      "No payment details were changed. You can start checkout again whenever you are ready."
    )
  })

  test("does not render a checkout alert by default", async ({ page }) => {
    // Given / When
    await page.goto("/pricing")

    // Then
    await expect(page.locator('[data-slot="alert"][role="alert"]')).toHaveCount(
      0
    )
  })
})
