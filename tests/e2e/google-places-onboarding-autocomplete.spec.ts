import { expect, test } from "@playwright/test"

const ONBOARDING_PREVIEW = "/dev/onboarding-preview?scenario="

test.describe("Google Places onboarding autocomplete (mocked localhost)", () => {
  test("a mocked selection fills the onboarding form and records provider provenance", async ({
    page,
  }) => {
    await page.goto(`${ONBOARDING_PREVIEW}places-mock`)

    const widget = page.getByTestId("venue-place-autocomplete")
    await expect(widget).toHaveAttribute("data-status", "ready")
    await expect(page.locator("gmp-place-autocomplete")).toHaveCount(0)

    await page.getByTestId("simulate-place-selection").click()

    await expect(page.locator('input[name="addressLine1"]')).toHaveValue(
      "High Street"
    )
    await expect(page.locator('input[name="addressCity"]')).toHaveValue(
      "Girton"
    )
    await expect(page.locator('input[name="addressPostcode"]')).toHaveValue(
      "CB3 0QH"
    )
    await expect(page.locator('input[name="locationName"]')).toHaveValue(
      "Old Crown"
    )
    await expect(page.locator('input[name="addressSource"]')).toHaveValue(
      "provider_lookup"
    )
    await expect(page.locator('input[name="addressProvider"]')).toHaveValue(
      "google_places"
    )
    await expect(page.locator('input[name="addressProviderId"]')).toHaveValue(
      "ChIJpreviewOldCrownGirton"
    )
  })

  test("no configured key renders the manual-only fallback on onboarding", async ({
    page,
  }) => {
    await page.goto(`${ONBOARDING_PREVIEW}places-nokey`)

    await expect(
      page.getByTestId("google-places-onboarding-preview")
    ).toHaveAttribute("data-api-key-configured", "false")
    await expect(page.getByTestId("venue-place-autocomplete")).toHaveCount(0)

    const line1 = page.locator('input[name="addressLine1"]')
    await line1.fill("5 Mill Road")
    await expect(line1).toHaveValue("5 Mill Road")
    await expect(page.locator('input[name="addressSource"]')).toHaveValue(
      "manual_entry"
    )
  })
})
