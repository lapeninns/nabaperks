import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

export function defineMerchantAuthRecoveryTests() {
  test.use({ serviceWorkers: "block" })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("signup correction preserves email, name, and destination context", async ({
    page,
  }) => {
    const next = "/app/onboarding?proof=context-round-trip"
    await page.goto(
      `/signup/verify?email=operator%40example.test&name=Alex%20Morgan&next=${encodeURIComponent(next)}`
    )

    await expect(
      page.getByRole("link", { name: "Back to sign up" })
    ).toHaveAttribute(
      "href",
      `/signup?email=operator%40example.test&name=Alex+Morgan&next=${encodeURIComponent(next)}`
    )
  })

  test("email-code sign-in resumes after refresh without a password field", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/reset-password?stage=verify&email=operator%40example.test&next=%2Fapp%2Fonboarding"
    )

    await expect(page.getByLabel("Sign-in code")).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expectNoAxeViolations(page, "merchant email-code verify stage")

    await page.reload()
    await expect(page.getByLabel("Sign-in code")).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test("email-code correction restores an editable address", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/reset-password?stage=verify&email=operator%40example.test&next=%2Fapp%2Fonboarding"
    )

    await page.getByRole("link", { name: "Use a different email" }).click()

    await expect(page).toHaveURL((url) => url.pathname === "/login")
    await expect(page.getByLabel("Venue email")).toBeEditable()
    await expect(page.getByLabel("Sign-in code")).toHaveCount(0)
  })

  test("invalid signup code is associated and returns focus to code entry", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/signup/verify?email=operator%40example.test&name=Alex%20Morgan"
    )
    const otp = page.getByLabel("Email code")

    await otp.fill("1")
    await page.getByRole("button", { name: "Verify email" }).click()

    await expect(
      page.getByRole("alert").filter({ hasText: "code from your email" })
    ).toBeVisible()
    await expect(otp).toBeFocused()
  })

  test("sign-in page presents enumeration-neutral email-code guidance", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/login?email=known%40example.test")

    await expect(page.getByLabel("Venue email")).toHaveValue(
      "known@example.test"
    )
    await expect(page.getByText(/one-time sign-in code/i)).toBeVisible()
    await expect(page.getByText(/account exists/i)).toHaveCount(0)
    await expect(page.getByText(/no account/i)).toHaveCount(0)
  })
}
