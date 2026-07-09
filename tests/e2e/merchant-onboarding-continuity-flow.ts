import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

const DRAFT_KEY = "nabaperks:onboarding-draft:usr_harness_onboarding"

export function defineMerchantOnboardingContinuityTests() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("server fields stay authoritative while a partial local draft restores the missing address", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key }) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            businessName: "Stale Draft Name",
            locationName: "Stale Draft Venue",
            addressLine1: "15 Market Street",
            addressLine2: "",
            addressCity: "Cambridge",
            addressPostcode: "CB2 3PA",
          })
        )
      },
      { key: DRAFT_KEY }
    )

    await page.goto(HARNESS_ROUTES.onboarding)

    await expect(page.locator('input[name="businessName"]')).toHaveValue(
      "Old Crown Girton"
    )
    await expect(page.locator('input[name="locationName"]')).toHaveValue(
      "Old Crown Girton"
    )
    await expect(page.locator('input[name="addressLine1"]')).toHaveValue(
      "15 Market Street"
    )
    await expect(page.locator('input[name="addressCity"]')).toHaveValue(
      "Cambridge"
    )
    await expect(page.locator('input[name="addressPostcode"]')).toHaveValue(
      "CB2 3PA"
    )
  })

  test("required-field failures stay client-side, announce, and refocus on every attempt", async ({
    page,
  }) => {
    await page.goto(HARNESS_ROUTES.onboarding)
    await page.locator('input[name="businessName"]').clear()
    await page.locator('input[name="locationName"]').clear()

    let actionPosts = 0
    page.on("request", (request) => {
      if (request.method() === "POST") actionPosts += 1
    })

    const submit = page.getByRole("button", { name: "Finish setup" })
    await submit.click()

    const businessName = page.locator('input[name="businessName"]')
    await expect(businessName).toBeFocused()
    await expect(
      page.getByRole("alert").filter({ hasText: "Enter the business name." })
    ).toBeVisible()
    expect(actionPosts).toBe(0)

    await submit.click()
    await expect(businessName).toBeFocused()
    await expect(
      page.getByRole("alert").filter({ hasText: "Enter the business name." })
    ).toBeVisible()
    expect(actionPosts).toBe(0)
  })
}
