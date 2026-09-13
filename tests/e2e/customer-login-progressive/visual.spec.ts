import { expect, test } from "@playwright/test"

test.use({ javaScriptEnabled: false })

test.beforeEach(async ({ page }) => {
  // The test harness marks the whole body inert until its hydration signal.
  // Production has no such guard. Remove only that test attribute from native
  // navigation responses so this fixture represents the ordinary no-JS page.
  await page.route("**/dev/customer-login", async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    expect(html).toContain('data-playwright-harness="true"')
    await route.fulfill({
      response,
      body: html.replace(/(<body\b[^>]*?)\s+inert=""/, "$1"),
    })
  })
})

test("login requests, resends and checks a code without JavaScript", async ({
  page,
}) => {
  await page.goto("/dev/customer-login")
  await page.getByLabel("Phone number", { exact: true }).fill("07700900123")
  await page.getByRole("button", { name: "Send code", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Enter your code" })
  ).toBeVisible()
  await page.getByLabel("Phone code").fill("000000")
  await page.getByRole("button", { name: "Open my cards" }).click()
  await expect(page.getByText("That code was not accepted.")).toBeVisible()
  await page.getByRole("button", { name: "Resend code" }).click()
  await expect(page.getByText("That code was not accepted.")).toHaveCount(0)
  await page.getByLabel("Phone code").fill("424242")
  await page.getByRole("button", { name: "Open my cards" }).click()
  await expect(
    page.getByText("Display verification complete. No session was created.")
  ).toBeVisible()
})
