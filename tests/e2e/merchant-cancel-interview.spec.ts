import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

const CANCELLABLE_STATES = ["trialing", "active", "past_due"] as const
const NON_CANCELLABLE_STATES = ["none", "cancelled"] as const

function cancelHarnessPath(billing: string) {
  return `${HARNESS_ROUTES.cancel}?billing=${encodeURIComponent(billing)}`
}

test.describe("merchant cancellation interview", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("cancellable billing states render the exit-review form @a11y", async ({
    page,
  }) => {
    for (const billing of CANCELLABLE_STATES) {
      await page.goto(cancelHarnessPath(billing))

      await expect(
        page.getByRole("heading", { name: "Before you cancel" })
      ).toBeVisible()
      await expect(page.locator("[data-cancellation-interview-form]")).toBeVisible()
      await expect(page.getByText("Main reason for leaving")).toBeVisible()
      await expect(
        page.getByRole("radio", { name: /Ask for a support call/i })
      ).toBeVisible()
      await expect(
        page.getByRole("radio", { name: /Continue to cancellation/i })
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Continue" })
      ).toBeVisible()
      await expect(
        page.getByText(
          "There is no active or trialling subscription available to cancel."
        )
      ).toHaveCount(0)
    }

    await expectNoAxeViolations(page, "cancellable cancellation interview form")
  })

  test("a support call request stays on the page without opening Stripe @a11y", async ({
    page,
  }) => {
    await page.goto(cancelHarnessPath("trialing"))

    const form = page.locator("[data-cancellation-interview-form]")
    await expect(form).toBeVisible()
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(
      page.getByRole("heading", { name: "Support follow-up requested" })
    ).toBeVisible()
    await expect(
      page.getByText("Your subscription has not been cancelled.")
    ).toBeVisible()
    await expect(form).toHaveCount(0)
    await expect(page.getByTestId("cancellation-interview-resolution")).toHaveText(
      "support_call"
    )
    expect(new URL(page.url()).pathname).toBe(HARNESS_ROUTES.cancel)
    expect(page.url()).not.toMatch(/stripe\.com/i)
    await expectNoAxeViolations(
      page,
      "cancellation interview support follow-up success"
    )
  })

  test("continue to cancellation keeps portal handoff busy and fails inline", async ({
    page,
  }) => {
    await page.goto(cancelHarnessPath("active"))

    const form = page.locator("[data-cancellation-interview-form]")
    const submit = form.locator('button[type="submit"]')

    await page.getByRole("radio", { name: /Continue to cancellation/i }).check()
    await submit.click()

    await expect(form).toHaveAttribute("aria-busy", "true")
    await expect(form.getByRole("status")).toHaveText("Saving your review…")
    await expect(submit).toBeDisabled()

    await submit.evaluate((button: HTMLButtonElement) => button.click())
    await expect(page.getByTestId("cancellation-interview-attempts")).toHaveText(
      "1"
    )
    await expect(page.getByTestId("cancellation-interview-resolution")).toHaveText(
      "continue_cancellation"
    )

    await expect(
      page.getByRole("heading", { name: "Exit review not saved" })
    ).toBeVisible()
    await expect(
      page.getByText("Stripe cancellation could not be opened. Please try again.")
    ).toBeVisible()
    await expect(submit).toBeEnabled()
    expect(new URL(page.url()).pathname).toBe(HARNESS_ROUTES.cancel)
    expect(page.url()).not.toMatch(/stripe\.com/i)
  })

  test("non-cancellable billing states show copy without the form", async ({
    page,
  }) => {
    for (const billing of NON_CANCELLABLE_STATES) {
      await page.goto(cancelHarnessPath(billing))

      await expect(
        page.getByRole("heading", { name: "Before you cancel" })
      ).toBeVisible()
      await expect(
        page.getByText(
          "There is no active or trialling subscription available to cancel."
        )
      ).toBeVisible()
      await expect(page.locator("[data-cancellation-interview-form]")).toHaveCount(
        0
      )
      await expect(page.getByText("Main reason for leaving")).toHaveCount(0)
      await expect(
        page.getByRole("button", { name: "Continue" })
      ).toHaveCount(0)
    }
  })
})
