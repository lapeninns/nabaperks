import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

export function defineDeliveryAnchoredPilotTests() {
  test.use({ serviceWorkers: "block" })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("merchant sees fulfilment state and exact delivery-anchored pilot dates @a11y", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.trial}?state=dispatched`)

    await expect(
      page.getByText("Posters and platform pilot", { exact: true })
    ).toBeVisible()
    const fulfilmentAlert = page.locator('[data-slot="alert"]')

    await expect(fulfilmentAlert).toContainText("Your posters are on the way")
    await expect(fulfilmentAlert).toContainText(
      "The 28-day platform pilot has not started yet"
    )
    await expectNoHorizontalOverflow(page)

    await gotoHydratedPage(page, `${HARNESS_ROUTES.trial}?state=delivered`)
    await expect(fulfilmentAlert).toContainText(
      "Your 28-day platform pilot is running"
    )
    await expect(page.getByText("9 August 2026", { exact: true })).toHaveCount(
      2
    )
    await expect(
      page.getByText("6 September 2026", { exact: true })
    ).toHaveCount(2)
    await expect(
      page.getByText(
        "Allow up to 14 calendar days for print and delivery. If delivery is delayed, recurring billing is held back so you keep the usable pilot."
      )
    ).toBeVisible()
    await expectNoAxeViolations(page, "delivery-anchored merchant pilot")
    await expectNoHorizontalOverflow(page)

    await gotoHydratedPage(page, `${HARNESS_ROUTES.trial}?state=review`)
    await expect(fulfilmentAlert).toContainText(
      "We are checking your pilot dates"
    )
  })

  test("admin can enter delivery evidence without losing fulfilment context @a11y", async ({
    page,
  }) => {
    await gotoHydratedPage(page, HARNESS_ROUTES.trialAdmin)

    await expect(
      page.getByRole("heading", { name: "Launch fulfilment" })
    ).toBeVisible()
    await expect(
      page.getByText("Posters dispatched", { exact: true })
    ).toBeVisible()
    await page.getByText("Fulfilment controls", { exact: true }).click()

    const deliveryTime = page.getByLabel("Delivery time")
    await expect(deliveryTime).toBeVisible()
    await deliveryTime.fill("2026-08-09T14:00")
    await expect(deliveryTime).toHaveValue("2026-08-09T14:00")
    await expect(
      page.getByRole("button", { name: "Confirm poster delivery" })
    ).toBeVisible()
    await expectNoAxeViolations(page, "admin delivery confirmation")
    await expectNoHorizontalOverflow(page)
  })

  test("merchant sees a completed pilot after recurring billing starts @a11y", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.trial}?state=expired`)

    const fulfilmentAlert = page.locator('[data-slot="alert"]')
    await expect(fulfilmentAlert).toContainText(
      "Your 28-day platform pilot has ended"
    )
    await expect(fulfilmentAlert).not.toContainText("pilot is running")
    await expectNoAxeViolations(page, "completed merchant pilot")
    await expectNoHorizontalOverflow(page)
  })

  test("public pricing explains launch, delivery and pilot before both cadences @a11y", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/pricing")
    const pricing = page.locator("[data-growth-plan-pricing]")

    await expect(pricing.getByText("£299.99", { exact: true })).toBeVisible()
    await expect(
      pricing.getByText("Up to 14 days", { exact: true })
    ).toBeVisible()
    await expect(pricing).toContainText("28-day free platform pilot")
    await expect(pricing).toContainText("poster delivery")
    await expect(pricing.getByText("£69.99", { exact: true })).toBeVisible()
    await expect(pricing.getByText("£699.90", { exact: true })).toBeVisible()
    await expect(pricing).not.toContainText("launch fee included")
    await expectNoAxeViolations(page, "delivery-anchored public pricing")
    await expectNoHorizontalOverflow(page)
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1
    )
  ).toBe(true)
}
