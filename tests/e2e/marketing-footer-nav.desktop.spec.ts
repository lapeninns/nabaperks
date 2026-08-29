import { expect, test } from "@playwright/test"

/**
 * The marketing footer is the site's secondary navigation on every public
 * route. 05#47 collapsed each column into a native `<details>` to save phone
 * height, but a `<details>` cannot be re-opened by media query: measured in
 * chromium, firefox and webkit, neither `details:not([open]) > *`,
 * `details { display: contents }` nor `details::details-content` reveals the
 * content in all three engines. The single-tree version therefore shipped with
 * columns 2-4 closed at EVERY width and `sm:pointer-events-none` on the
 * summary, so 8 of 13 links were invisible and unopenable on desktop while
 * saving nothing (the desktop footer is the same height either way). This
 * guards the two-branch replacement: disclosure below `sm`, plain list above.
 */
const SITE_LINK_COUNT = 13

test.describe("marketing footer navigation", () => {
  test("Given a desktop viewport When the marketing footer renders Then every site link is visible", async ({
    page,
  }) => {
    await page.goto("/")
    const links = page.locator('footer nav[aria-label="Site links"] a')

    for (const width of [640, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      const visible = links.locator("visible=true")
      await expect(
        visible,
        `all ${SITE_LINK_COUNT} footer site links must be visible at ${width}px`
      ).toHaveCount(SITE_LINK_COUNT)
    }
  })

  test("Given a phone viewport When the marketing footer renders Then it is a working disclosure", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")

    const nav = page.locator('footer nav[aria-label="Site links"]')
    const visible = nav.locator("a").locator("visible=true")
    // Only the first column ("Product", 5 links) is open by default.
    await expect(visible).toHaveCount(5)

    const guides = nav.locator("details").filter({ hasText: "Guides" })
    await guides.locator("summary").click()
    await expect(visible).toHaveCount(8)
  })
})
