import { expect, test } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440] as const
const STEPS = [
  "Venue + card setup",
  "Rewards configured",
  "Automations on",
  "Posters printed + posted",
  "You go live",
] as const

for (const theme of ["light", "dark"] as const) {
  test(`launch ticket preserves complete step labels at narrow widths in ${theme}`, async ({
    page,
  }, testInfo) => {
    // Given the native public page and its five launch steps.
    await dismissPwaInstall(page)
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.addInitScript(
      (value) => localStorage.setItem("nabaperks-theme", value),
      theme
    )
    await gotoHydratedPage(page, "/how-it-works")
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`))
    const ticket = page.locator("[data-slot='card']").filter({
      has: page.getByText("Launch ticket", { exact: true }),
    })

    // When the actual browser viewport narrows and the receipt reflows.
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 })
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width)
      await expect(ticket.locator("li")).toHaveCount(STEPS.length)
      for (const step of STEPS) {
        const label = ticket.getByText(step, { exact: true })
        await expect(label).toBeVisible()
        // Then the rendered label's full glyphs fit, without ellipsis or crop.
        await expect
          .poll(() =>
            label.evaluate(async (element) => {
              await document.fonts.ready
              const range = document.createRange()
              range.selectNodeContents(element)
              const bounds = range.getBoundingClientRect()
              const card = element.closest("[data-slot='card']")
              if (!card) return false
              const cardBounds = card.getBoundingClientRect()
              return (
                element.scrollWidth <= element.clientWidth + 1 &&
                element.scrollHeight <= element.clientHeight + 1 &&
                bounds.left >= 0 &&
                bounds.right <= innerWidth &&
                bounds.left >= cardBounds.left &&
                bounds.right <= cardBounds.right
              )
            })
          )
          .toBe(true)
      }
      if (width === 320) {
        await ticket.scrollIntoViewIfNeeded()
        await testInfo.attach(`launch-ticket-${theme}-320`, {
          body: await page.screenshot(),
          contentType: "image/png",
        })
      }
    }
  })
}
