import { expect, test } from "@playwright/test"

test.use({ javaScriptEnabled: false })

test.beforeEach(async ({ page }) => {
  // The test harness marks the whole body inert until its hydration signal.
  // Production has no such guard. Remove only that test attribute from native
  // navigation responses so this fixture represents the ordinary no-JS page.
  await page.route(
    (url) => url.pathname === "/dev/customer-login",
    async (route) => {
      const response = await route.fetch()
      const html = await response.text()
      expect(html).toContain('data-playwright-harness="true"')
      await route.fulfill({
        response,
        body: html.replace(/(<body\b[^>]*?)\s+inert=""/, "$1"),
      })
    }
  )
})

test("login corrects the number, resends and checks a code without JavaScript", async ({
  page,
}) => {
  await page.goto("/dev/customer-login?next=%2Fhome%2Frewards")
  await page.getByLabel("UK mobile number", { exact: true }).fill("07700900123")
  await page.getByRole("button", { name: "Send my code", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Enter your code" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Wrong number? Change it" }).click()
  const phone = page.getByLabel("UK mobile number", { exact: true })
  await expect(phone).toBeVisible()
  await expect(phone).toHaveValue("07700 900123")
  await phone.fill("07700900456")
  await page.getByRole("button", { name: "Send my code", exact: true }).click()
  await expect(page.getByText(/to 07•••• ••456\./)).toBeVisible()
  await expect(page.locator('input[name="next"]')).toHaveValue("/home/rewards")
  await page.getByLabel("Your code").fill("000000")
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(
    page.getByText("That code didn't work. Check it and try again.")
  ).toBeVisible()
  await page.getByRole("button", { name: "Send a new code" }).click()
  await expect(
    page.getByText("That code didn't work. Check it and try again.")
  ).toHaveCount(0)
  await page.getByLabel("Your code").fill("424242")
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(
    page.getByText("Display verification complete. No session was created.")
  ).toBeVisible()
})
