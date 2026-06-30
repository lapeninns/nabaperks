import { expect, test } from "@playwright/test"

import { adminLiveDbSkipReason } from "./helpers/admin-live-db"
import { dismissPwaInstall } from "./helpers/harness"

const SEED_MERCHANT_EMAIL = "mia@old-crown-girton.test"
const SEED_MERCHANT_PASSWORD = "NabaperksDemo1!"

export function describeMerchantSafeRedirects(): void {
  test.describe("@admin-live-db merchant safe redirects", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("successful merchant login rejects whitespace open-redirect next payloads", async ({
      page,
    }) => {
      const unsafeNext = "/\t/evil.example"

      await page.goto(`/login?next=${encodeURIComponent(unsafeNext)}`)
      const sameOrigin = new URL(page.url()).origin

      await expect(
        page.getByRole("heading", { name: "Back to the counter" })
      ).toBeVisible()

      await page.locator("#email").fill(SEED_MERCHANT_EMAIL)
      await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
      await page.getByRole("button", { name: "Log in" }).click()

      await expect(page).toHaveURL((url) => url.pathname !== "/login")

      const redirectedUrl = new URL(page.url())
      expect(redirectedUrl.origin).toBe(sameOrigin)
      expect(redirectedUrl.hostname).not.toBe("evil.example")
      expect(redirectedUrl.pathname).toBe("/app")
    })
  })
}
