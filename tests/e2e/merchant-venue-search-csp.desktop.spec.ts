import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupMerchantOnboardingLiveDbFixture,
  createMerchantOnboardingLiveDbFixture,
  type MerchantOnboardingLiveDbFixture,
} from "./helpers/merchant-onboarding-live-db"

test.describe("merchant venue search CSP", () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "block",
  })
  test.skip(
    process.env.ADMIN_LIVE_DB_E2E !== "1",
    "Set ADMIN_LIVE_DB_E2E=1 with disposable local Supabase to run authenticated venue-search proof"
  )

  test("the trusted Places loader reaches ready state without weakening fallback recovery", async ({
    page,
    context,
  }) => {
    const sql = connectLocalDb()
    if (!sql) throw new Error("Owned local database is required")
    let fixture: MerchantOnboardingLiveDbFixture | undefined
    try {
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

      await context.route(
        /^https:\/\/maps\.googleapis\.com\/maps\/api\/js(?:\?|$)/,
        async (route) => {
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
        }
      )

      fixture = await createMerchantOnboardingLiveDbFixture(sql, page.context())
      await page.goto("/app/onboarding")

      const autocomplete = page.getByTestId("venue-place-autocomplete")
      await expect(autocomplete).toHaveAttribute("data-status", "ready")
      await expect(
        page.getByText(
          "Search Google for your venue, or enter the address below."
        )
      ).toBeVisible()
      await expect(page.getByLabel(/Address line 1.*required/i)).toBeVisible()

      expect(mapsScriptRequested).toBe(true)
      expect(cspErrors).toEqual([])
    } finally {
      if (fixture) await cleanupMerchantOnboardingLiveDbFixture(sql, fixture)
      await sql.end({ timeout: 5 })
    }
  })
})
