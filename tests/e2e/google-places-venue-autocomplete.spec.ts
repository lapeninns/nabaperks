import { expect, test } from "@playwright/test"

// Mocked-Google browser proof for the merchant Launch venue Google Places
// autocomplete. The dev preview harness installs a fake
// `window.google.maps.importLibrary` before the widget mounts and injects a
// dummy key via a DI prop, so these checks never require a real key or a live
// Google network call (guardrail: no live Google in automated evidence).

const PREVIEW = "/dev/launch-preview?tab=venue&scenario="

test.describe("Google Places venue autocomplete (mocked)", () => {
  test("a mocked selection fills the venue form and records provider provenance", async ({
    page,
  }) => {
    await page.goto(`${PREVIEW}places-mock`)

    const widget = page.getByTestId("venue-place-autocomplete")
    await expect(widget).toHaveAttribute("data-status", "ready")
    // The mock must not load the real Places element / make a live call.
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
    await expect(page.locator('input[name="venueName"]')).toHaveValue(
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
    await expect(page.locator('input[name="providerLatitude"]')).toHaveValue(
      "52.2425913"
    )
    await expect(page.locator('input[name="providerLongitude"]')).toHaveValue(
      "0.0814946"
    )
  })

  test("editing the address after a selection resets provider provenance to manual", async ({
    page,
  }) => {
    await page.goto(`${PREVIEW}places-mock`)
    await expect(page.getByTestId("venue-place-autocomplete")).toHaveAttribute(
      "data-status",
      "ready"
    )

    await page.getByTestId("simulate-place-selection").click()
    await expect(page.locator('input[name="addressSource"]')).toHaveValue(
      "provider_lookup"
    )

    await page.locator('input[name="addressLine1"]').fill("12 New Road")

    await expect(page.locator('input[name="addressSource"]')).toHaveValue(
      "manual_entry"
    )
    await expect(page.locator('input[name="addressProviderId"]')).toHaveValue(
      ""
    )
    await expect(page.locator('input[name="providerLatitude"]')).toHaveValue("")
  })

  test("no configured key renders the manual-only fallback", async ({
    page,
  }) => {
    await page.goto(`${PREVIEW}places-nokey`)

    await expect(
      page.getByTestId("google-places-venue-preview")
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
