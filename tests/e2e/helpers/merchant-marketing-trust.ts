import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./harness"

const PUBLIC_TRUST_ROUTES = [
  "/",
  "/pricing",
  "/how-it-works",
  "/about",
  "/loyalty-for-pubs",
  "/loyalty-for-cafes",
  "/loyalty-for-takeaways",
  "/loyalty-for-bars",
] as const

export function defineMerchantMarketingTrustTests() {
  test.describe("merchant acquisition trust", () => {
    test.use({ serviceWorkers: "block" })

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("home puts the post-pilot price inside the initial decision viewport", async ({
      page,
    }) => {
      const response = await page.goto("/")
      expect(response?.status()).toBeLessThan(400)

      const price = page.getByText(/30-day pilot, then £49\/mo/i).first()
      await expect(price).toBeVisible()
      const box = await price.boundingBox()
      const viewport = page.viewportSize()
      expect(box).not.toBeNull()
      expect(viewport).not.toBeNull()
      expect((box?.y ?? Infinity) + (box?.height ?? 0)).toBeLessThanOrEqual(
        viewport?.height ?? 0
      )

      await expect(page.getByText(/print-run spots? left/i)).toHaveCount(0)
      await expect(
        page.getByText(/customers stamped in the last 3 months/i)
      ).toHaveCount(0)
      await expect(page.getByText("Real numbers", { exact: true })).toHaveCount(0)
    })

    test("signup discloses the continuation price before account fields", async ({
      page,
    }) => {
      await page.goto("/signup")

      const price = page.getByText(/then £49\/month per venue/i).first()
      await expect(price).toBeVisible()
      const priceBox = await price.boundingBox()
      const emailBox = await page.getByLabel(/email/i).boundingBox()
      expect(priceBox).not.toBeNull()
      expect(emailBox).not.toBeNull()
      expect(priceBox?.y ?? Infinity).toBeLessThan(emailBox?.y ?? 0)
      await expect(page.getByText(/about five minutes/i)).toHaveCount(0)
    })

    test("setup names billing as the activation gate", async ({
      page,
    }) => {
      await page.goto("/how-it-works")
      await expect(page.getByText(/Five guided steps/i).first()).toBeVisible()
      await expect(page.locator("body")).toContainText(/activate billing/i)
    })

    for (const route of PUBLIC_TRUST_ROUTES) {
      test(`${route} avoids absolute fraud and timing promises`, async ({
        page,
      }) => {
        await page.goto(route)
        const body = await page.locator("body").innerText()
        expect(body).not.toMatch(
          /counter-verified|can(?:not|'t) be faked|fraud is designed out|stops self-stamping|first repeat visit inside the first week/i
        )
      })
    }
  })
}
