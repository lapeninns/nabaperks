import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

test.describe("merchant billing recovery", () => {
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
    await expect(page.getByText("30 days", { exact: true })).toBeVisible()
    await expect(page.getByText("£0", { exact: true })).toBeVisible()
    await expect(page.getByText("£49 a month", { exact: true })).toBeVisible()
    await expect(
      page.getByText(
        "Secure checkout via Stripe. Cancel renewal from your billing page."
      )
    ).toBeVisible()
    await expect(page.getByText("First-Regular Guarantee:")).toBeVisible()
    await expect(
      page.getByText(
        "If your live card hasn't brought back a first regular by the end of your 30-day pilot, the pilot stays free until it does."
      )
    ).toBeVisible()
    await expectNoAxeViolations(page, "setup billing activation continuity")

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
    await expect(page.getByText("30-day free trial is active")).toBeVisible()
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
    await expect
      .poll(() => new URL(page.url()).searchParams.has("checkout"))
      .toBe(false)

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
    await expectNoAxeViolations(page, "annual billing receipt")

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("complimentary access stays launch-neutral and never offers Stripe checkout @a11y", async ({
    page,
  }) => {
    await page.goto(
      `${HARNESS_ROUTES.account}?tab=billing&access=complimentary&checkout=success&session_id=cs_harness_foreign`
    )

    await expect(
      page.getByRole("heading", { name: "Complimentary access" })
    ).toBeVisible()
    await expect(
      page.getByText("No new card or Stripe subscription is required")
    ).toBeVisible()
    await expect(page.getByText("£0", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Billing access is active" })
    ).toBeVisible()
    await expect(
      page.getByText("Venue launch status is shown separately")
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /billing|stripe/i })
    ).toHaveCount(0)
    await expect(page.locator("[data-billing-checkout-form]")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Open Stripe portal" })
    ).toHaveCount(0)
    await expect
      .poll(() => new URL(page.url()).searchParams.has("checkout"))
      .toBe(false)
    expect(new URL(page.url()).searchParams.has("session_id")).toBe(false)
    await expectNoAxeViolations(page, "complimentary owner billing access")

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("complimentary access preserves management of existing Stripe billing", async ({
    page,
  }) => {
    await page.goto(
      `${HARNESS_ROUTES.account}?tab=billing&access=complimentary&billing=trialing`
    )

    await expect(page.locator("[data-billing-checkout-form]")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Manage existing Stripe billing" })
    ).toBeVisible()
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
    expect(
      await monthly.evaluate((button) => button.getBoundingClientRect().height)
    ).toBeGreaterThanOrEqual(44)
    expect(
      await annual.evaluate((button) => button.getBoundingClientRect().height)
    ).toBeGreaterThanOrEqual(44)
    await monthly.click()
    await expect(form).toHaveAttribute("aria-busy", "true")
    await expect(form.getByRole("status")).toHaveText(
      "Opening monthly Stripe checkout…"
    )
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
