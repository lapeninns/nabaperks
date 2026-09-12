import { expect, test } from "@playwright/test"

test.use({ javaScriptEnabled: false })

test("counter confirmations work without JavaScript", async ({
  page,
  browserName,
}) => {
  test.setTimeout(30_000)
  test.skip(
    browserName !== "chromium",
    "Native form validation proof uses Chromium"
  )
  await page.goto("/dev/welcome-offer?surface=counter")
  // The Playwright-only root gate marks the entire body inert until its
  // hydration signal runs. Production does not add this gate. Remove only
  // that test gate; application JavaScript remains disabled in this context.
  if (await page.locator('html[data-playwright-harness="true"]').count()) {
    await page.locator("body").evaluate((body) => body.removeAttribute("inert"))
  }
  const apply = page.getByRole("button", { name: "Apply 10% off" })
  await expect(apply).toBeEnabled()
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST") requests.push(request.url())
  })
  await apply.click({ noWaitAfter: true, timeout: 5_000 })
  await expect(page.locator('[name="idChecked"]')).toBeFocused()
  await page.locator('[name="idChecked"]').check()
  await apply.click({ noWaitAfter: true, timeout: 5_000 })
  await expect(page.locator('[name="noStacking"]')).toBeFocused()
  expect(requests).toEqual([])
  await page.locator('[name="noStacking"]').check()
  expect(
    await apply
      .locator("xpath=ancestor::form")
      .evaluate((el) => (el as HTMLFormElement).checkValidity())
  ).toBe(true)
})
