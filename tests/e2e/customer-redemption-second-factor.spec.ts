import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

const HARNESS = "/dev/home-harness/redemption-second-factor"
const COLLECTION_QR = /QR code for collecting A mystery reward/i
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
)

async function mockReadyCollectionRoutes(page: Page): Promise<void> {
  await page.route("**/reward/*/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ redeemed: false }),
    })
  })
  await page.route("**/reward/*/qr.png**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: ONE_PIXEL_PNG,
    })
  })
}

test.describe("reward collection second-factor gates", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("email-code gate keeps the collection QR hidden @a11y", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?gate=email-code`)

    await expect(
      page.getByText(/Enter the code we sent to alex@example.test/i)
    ).toBeVisible()
    await expect(page.getByLabel("Email code")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Confirm email" })
    ).toBeVisible()
    await expect(page.getByRole("img", { name: COLLECTION_QR })).toHaveCount(0)
    await expectNoAxeViolations(page, "reward collection email-code gate")
  })

  test("ready gate reveals the collection QR after email verification", async ({
    page,
  }) => {
    await mockReadyCollectionRoutes(page)
    await page.goto(`${HARNESS}?gate=ready`)

    await expect(
      page.getByText("Ready for merchant scan.", { exact: true })
    ).toBeVisible()
    await expect(page.getByRole("img", { name: COLLECTION_QR })).toBeVisible()
    await expect(page.getByLabel("Email code")).toHaveCount(0)
  })
})
