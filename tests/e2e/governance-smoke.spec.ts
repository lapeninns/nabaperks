import { expect, test } from "@playwright/test"

test.describe("governance browser gate", () => {
  test("Given the public app When a browser opens the landing page Then the core route renders @governance", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(page).toHaveTitle(/Nabaperks/)
    await expect(
      page.getByRole("link", { name: /Pricing|View pricing/i }).first()
    ).toBeVisible()
    await expect(page.locator("body")).toContainText("No-app QR loyalty")
  })

  test("Given the public landing page When accessibility smoke runs Then primary landmarks are discoverable @a11y", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(page.getByRole("banner")).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
    await expect(
      page
        .getByRole("heading", { name: /The loyalty card that just opens/i })
        .first()
    ).toBeVisible()
  })

  test("Given the public landing page When visual smoke runs Then the hero occupies a non-empty viewport surface", async ({
    page,
  }) => {
    await page.goto("/")

    const hero = page.locator("main").first()

    await expect(hero).toBeVisible()
    const screenshot = await hero.screenshot()

    expect(screenshot.byteLength).toBeGreaterThan(10_000)
  })
})
