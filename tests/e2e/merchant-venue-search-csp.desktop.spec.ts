import { expect, test } from "@playwright/test"

const SEED_MERCHANT_EMAIL = "mia@old-crown-girton.test"
const SEED_MERCHANT_PASSWORD = "NabaperksDemo1!"

test.describe("merchant venue search CSP @MS-merchant-venue-search-csp", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("the trusted Places loader reaches ready state without weakening fallback recovery", async ({
    page,
  }) => {
    const cspErrors: string[] = []
    let mapsScriptRequested = false

    page.on("console", (message) => {
      const text = message.text()
      if (
        message.type() === "error" &&
        /content security policy|violates the following content security policy/i.test(
          text
        )
      ) {
        cspErrors.push(text)
      }
    })

    await page.route("https://maps.googleapis.com/maps/api/js?**", async (route) => {
      mapsScriptRequested = true
      await route.fulfill({
        contentType: "application/javascript",
        body: `
          window.google = {
            maps: {
              importLibrary: async () => ({
                PlaceAutocompleteElement: class {
                  constructor() {
                    const element = document.createElement("input")
                    element.type = "search"
                    return element
                  }
                }
              })
            }
          };
          window.__nabaperksGoogleMapsReady();
        `,
      })
    })

    await page.goto("/login")
    await page.locator("#email").fill(SEED_MERCHANT_EMAIL)
    await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
    await page.getByRole("button", { name: "Log in" }).click()
    await page.waitForURL(/\/app(?:\/onboarding)?(?:\?|$)/)
    await page.goto("/app/onboarding")

    const autocomplete = page.getByTestId("venue-place-autocomplete")
    await expect(autocomplete).toHaveAttribute("data-status", "ready")
    await expect(
      page.getByText("Search Google for your venue, or enter the address below.")
    ).toBeVisible()
    await expect(page.getByLabel(/Address line 1.*required/i)).toBeVisible()

    expect(mapsScriptRequested).toBe(true)
    expect(cspErrors).toEqual([])
  })
})
