import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

test.describe("merchant billing recovery desktop", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("setup billing keeps the exact plan and reassurance usable before QR unlock @a11y", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?tab=billing&state=billing`)

    await expect(
      page.getByRole("region", { name: "Built card and QR preview" })
    ).toHaveCount(0)
    await expect(page.getByRole("img", { name: /^QR code for / })).toHaveCount(
      0
    )
    await expect(
      page.getByRole("heading", { name: "Activate your venue" })
    ).toBeVisible()
    await expect(page.getByText("Growth Plan", { exact: true })).toBeVisible()
    await expect(page.getByText("28 days free", { exact: true })).toBeVisible()
    await expect(page.getByText("£299.99", { exact: true })).toBeVisible()
    await expect(
      page.getByText("£69.99 every 28 days", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(
        "Secure checkout via Stripe. Cancel anytime from your billing page."
      )
    ).toBeVisible()
    await expect(page.getByText("First-Regular Guarantee:")).toBeVisible()
    await expect(
      page.getByText(
        "If your live card hasn't brought back a first regular by the end of your 28-day pilot, the platform pilot stays free until it does."
      )
    ).toBeVisible()
    await expectNoAxeViolations(
      page,
      "setup billing activation continuity desktop"
    )

    for (const button of [
      page.getByRole("button", {
        name: /Continue.*£299\.99.*£69\.99.*28 days/i,
      }),
    ]) {
      await expect(button).toBeVisible()
      expect(
        await button.evaluate(
          (element) => element.getBoundingClientRect().height
        )
      ).toBeGreaterThanOrEqual(44)
      expect(
        await button.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1
        )
      ).toBe(true)
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
    await expect(
      page.getByText("28-day free platform pilot is active")
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "See your venue QR" })
    ).toHaveAttribute("href", "/app/launch?tab=qr")
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

  test("a confirmed lapsed portal return refreshes billing without claiming the QR unlocked", async ({
    page,
  }) => {
    await page.goto(
      `${HARNESS_ROUTES.account}?tab=billing&billing=cancelled&portal=returned`
    )

    await expect(
      page.getByRole("heading", { name: "Billing details refreshed" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "See your venue QR" })
    ).toHaveCount(0)
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

    await expect(page.getByText("£690 a year", { exact: true })).toBeVisible()
    await expect(
      page.getByText("Paid upfront · no free trial", { exact: true })
    ).toBeVisible()
    await expect(page.getByText("Free trial", { exact: true })).toHaveCount(0)
    await expect(page.getByText("£69 a month", { exact: true })).toHaveCount(0)
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

    const recurring = page.getByRole("button", {
      name: /Restart billing.*£69\.99 every 28 days/i,
    })
    const form = page.locator("[data-billing-checkout-form]")

    await expect(recurring).toBeVisible()
    await recurring.click()
    await expect(form).toHaveAttribute("aria-busy", "true")
    await expect(recurring).toBeDisabled()

    await recurring.evaluate((button: HTMLButtonElement) => button.click())
    await expect(page.getByTestId("billing-checkout-attempts")).toHaveText("1")

    const alert = page.getByRole("alert", { name: "Billing was not started" })
    await expect(alert).toContainText("Billing was not started")
    await expect(alert).toBeFocused()
    await expect(recurring).toBeEnabled()
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
