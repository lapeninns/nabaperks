import { expect, test } from "@playwright/test"

/**
 * The admin command palette (ADM 04#6).
 *
 * Driven through the harness because the palette lives in the admin shell and
 * every /admin route redirects to /login, so a browser test can never follow a
 * navigation out of it. That is also why the options are real anchors rather
 * than `router.push` — an href can be asserted, a push into an auth wall
 * cannot.
 */
test("admin command palette opens, filters, and carries the venue term", async ({
  page,
}) => {
  await page.goto("/dev/app-harness/trial/admin-command", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  })
  await page.waitForTimeout(600)

  await expect(page.locator("[role=listbox]")).toHaveCount(0)

  await page.keyboard.press("Control+k")
  await expect(page.locator("[role=listbox]")).toHaveCount(1)

  // Every route in the sidebar, and no others.
  await expect(page.locator("[role=option]")).toHaveCount(11)
  expect(await page.evaluate(() => document.activeElement?.id)).toBe(
    "admin-palette-input"
  )

  // A term plus a venue-searchable route carries through as ?venue=.
  await page.keyboard.type("merch")
  await expect(page.locator("[role=option]")).toHaveCount(1)
  await expect(page.locator("[role=option]").first()).toHaveAttribute(
    "href",
    "/admin/merchants?venue=merch"
  )

  // A route with no venue dimension must NOT be given the param.
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press("Backspace")
  }
  await page.keyboard.type("secur")
  await expect(page.locator("[role=option]")).toHaveCount(1)
  await expect(page.locator("[role=option]").first()).toHaveAttribute(
    "href",
    "/admin/security"
  )

  await page.keyboard.press("Escape")
  await expect(page.locator("[role=listbox]")).toHaveCount(0)
})
