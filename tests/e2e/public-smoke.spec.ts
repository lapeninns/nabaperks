import { expect, test } from "@playwright/test"

test.describe("public browser smoke", () => {
  test("Given the public site root When a browser opens it Then the offer landing page renders @smoke", async ({
    page,
  }) => {
    const response = await page.goto("/")

    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Pub Loyalty Cards Without an App/)
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "The 30-Day First-Regular Launch",
      })
    ).toBeVisible()
    await expect(page.getByRole("banner")).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("Given merchant sign-up When accessibility smoke runs Then primary landmarks and fields are discoverable @a11y", async ({
    page,
  }) => {
    const response = await page.goto("/signup")

    expect(response?.ok()).toBe(true)
    await expect(page.getByRole("banner")).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
    await expect(page.getByLabel("Your name")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Create account" })
    ).toBeVisible()
  })

  test("Given a retained legal page When visual smoke runs Then it occupies a non-empty viewport surface", async ({
    page,
  }) => {
    const response = await page.goto("/privacy")
    expect(response?.ok()).toBe(true)

    const main = page.locator("main").first()
    await expect(main).toBeVisible()
    const screenshot = await main.screenshot()
    expect(screenshot.byteLength).toBeGreaterThan(10_000)
  })
})
