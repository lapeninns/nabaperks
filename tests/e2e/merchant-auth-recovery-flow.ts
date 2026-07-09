import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

export function defineMerchantAuthRecoveryTests() {
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

    const correction = page.getByRole("link", { name: "Back to sign up" })
    await expect(correction).toHaveAttribute(
      "href",
      `/signup?email=operator%40example.test&name=Alex+Morgan&next=${encodeURIComponent(next)}`
    )
  })

  test("password reset verification resumes after refresh with live password guidance", async ({
    page,
  }) => {
    await page.goto(
      "/reset-password?stage=verify&email=operator%40example.test&next=%2Fapp%2Fonboarding"
    )

    await expect(page.getByLabel("Reset code")).toBeVisible()
    await expect(page.getByLabel("New password")).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Password rules" })
    ).toBeVisible()

    await page.reload()

    await expect(page.getByLabel("Reset code")).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Password rules" })
    ).toBeVisible()
  })
}
