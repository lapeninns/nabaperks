import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

test.describe("start resolver destination gates", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("anonymous start launches the chooser", async ({ page }) => {
    const response = await page.goto("/start")

    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole("heading", { name: "Welcome to Nabaperks" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Scan a QR" })).toHaveAttribute(
      "href",
      "/scan"
    )
    await expect(
      page.getByRole("link", { name: "Open my cards" })
    ).toHaveAttribute("href", "/home/login")
    await expect(
      page.getByRole("link", { name: "Merchant sign-in" })
    ).toHaveAttribute("href", "/login")
  })

  test("anonymous merchant destination re-gates to merchant login", async ({
    page,
  }) => {
    await page.goto("/app")
    await expect(page).toHaveURL(/\/login\?/)

    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("next")).toBe("/app")
    await expect(
      page.getByRole("heading", {
        name: "Welcome back to your loyalty counter.",
      })
    ).toBeVisible()
  })

  test("anonymous customer destination re-gates to customer login", async ({
    page,
  }) => {
    await page.goto("/home")
    await expect(page).toHaveURL(/\/home\/login\?/)

    const url = new URL(page.url())
    expect(url.pathname).toBe("/home/login")
    expect(url.searchParams.get("next")).toBe("/home")
    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible()
  })

  test("anonymous admin destination re-gates to merchant login", async ({
    page,
  }) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/login\?/)

    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("next")).toBe("/admin")
    await expect(
      page.getByRole("heading", { name: "Back to the counter" })
    ).toBeVisible()
  })
})
