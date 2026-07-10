import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

test.describe("merchant billing recovery desktop @MS-billing-checkout-recovery @MS-analytics-merchant-billing-telemetry", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("setup billing keeps the exact trial and price contract usable", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?tab=billing&state=billing`)

    await expect(
      page.getByRole("heading", { name: "Activate your venue" })
    ).toBeVisible()
    await expect(page.getByText("30 days", { exact: true })).toBeVisible()
    await expect(page.getByText("£0", { exact: true })).toBeVisible()
    await expect(page.getByText("£49 a month", { exact: true })).toBeVisible()

    for (const button of [
      page.getByRole("button", { name: /Proceed to billing.*£49\/month/i }),
      page.getByRole("button", { name: /Pay yearly.*£490/i }),
    ]) {
      await expect(button).toBeVisible()
      expect(
        await button.evaluate(
          (element) => element.getBoundingClientRect().height
        )
      ).toBeGreaterThanOrEqual(44)
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("owned completed trial confirms once and does not replay on refresh", async ({
    page,
  }) => {
    await page.goto(
      `${HARNESS_ROUTES.account}?tab=billing&billing=trialing&checkout=success&session_id=cs_harness_owned`
    )

    await expect(
      page.getByRole("heading", { name: "Checkout confirmed" })
    ).toBeVisible()
    await expect(page.getByText("30-day free trial is active")).toBeVisible()
    await expect
      .poll(() => new URL(page.url()).searchParams.has("checkout"))
      .toBe(false)
    expect(new URL(page.url()).searchParams.has("session_id")).toBe(false)

    await page.reload()
    await expect(
      page.getByRole("heading", { name: "Checkout confirmed" })
    ).toHaveCount(0)
    await expect
      .poll(() => new URL(page.url()).searchParams.has("checkout"))
      .toBe(false)
  })

  test("missing and foreign Session ids never claim billing success", async ({
    page,
  }) => {
    await page.goto(
      `${HARNESS_ROUTES.account}?tab=billing&billing=none&checkout=success`
    )
    await expect(
      page.getByRole("heading", { name: "Billing not confirmed" })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Checkout confirmed" })
    ).toHaveCount(0)

    await page.goto(
      `${HARNESS_ROUTES.account}?tab=billing&billing=none&checkout=success&session_id=cs_harness_foreign`
    )
    await expect(
      page.getByRole("heading", { name: "Billing not confirmed" })
    ).toBeVisible()
    await expect(page.getByText(/does not match this venue/i)).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Checkout confirmed" })
    ).toHaveCount(0)
  })

  test("annual subscribers see the exact annual receipt @a11y", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.account}?tab=billing&billing=active-year`)

    await expect(page.getByText("£490 a year", { exact: true })).toBeVisible()
    await expect(page.getByText("£49 a month", { exact: true })).toHaveCount(0)
    await expectNoAxeViolations(page, "annual billing receipt desktop")

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("cancelled billing restarts once and keeps provider failure inline", async ({
    page,
  }) => {
    await page.goto(
      `${HARNESS_ROUTES.account}?tab=billing&billing=cancelled&checkout_action=fail`
    )

    const monthly = page.getByRole("button", {
      name: /Restart billing.*£49\/month/i,
    })
    const annual = page.getByRole("button", { name: /Pay yearly.*£490/i })
    const form = page.locator("[data-billing-checkout-form]")

    await expect(monthly).toBeVisible()
    await monthly.click()
    await expect(form).toHaveAttribute("aria-busy", "true")
    await expect(monthly).toBeDisabled()
    await expect(annual).toBeDisabled()

    await annual.evaluate((button: HTMLButtonElement) => button.click())
    await expect(page.getByTestId("billing-checkout-attempts")).toHaveText("1")

    const alert = page.getByRole("alert", { name: "Billing was not started" })
    await expect(alert).toContainText("Billing was not started")
    await expect(alert).toBeFocused()
    await expect(monthly).toBeEnabled()
    await expect(annual).toBeEnabled()
  })

  test("Portal return shows scheduled cancellation once", async ({ page }) => {
    await page.goto(
      `${HARNESS_ROUTES.account}?tab=billing&billing=scheduled-cancellation&portal=returned`
    )

    await expect(
      page.getByRole("heading", { name: "Billing details refreshed" })
    ).toBeVisible()
    await expect(page.getByText(/Cancels on 9 Aug 2026/i)).toBeVisible()
    await expect
      .poll(() => new URL(page.url()).searchParams.has("portal"))
      .toBe(false)
  })
})
