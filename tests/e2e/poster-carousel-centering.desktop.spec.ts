import { expect, test } from "@playwright/test"

import { gotoHydratedPage } from "./helpers/harness"

for (const width of [390, 1280]) {
  test(`poster selection centres every real preview at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await gotoHydratedPage(
      page,
      "/dev/app-harness/launch?state=live&tab=qr&concept=redesign"
    )
    const positions = page.getByRole("button", { name: /^Show .+ poster$/ })
    const names = await positions.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label") ?? "")
    )
    expect(names).toHaveLength(8)
    for (const name of names) {
      const button = page.getByRole("button", { name, exact: true })
      await button.click()
      await expect(button).toHaveAttribute("aria-current", "true")
      const preview = page.getByRole("img", {
        name: name.replace(/^Show /, "").replace(/ poster$/, " poster preview"),
        exact: true,
      })
      await expect
        .poll(() =>
          preview.evaluate((element) => {
            const track = element.closest("[data-testid='poster-swipe-track']")
            const slide = element.closest("article")
            if (!track || !slide) return false
            const image = element.getBoundingClientRect()
            const viewport = track.getBoundingClientRect()
            const card = slide.getBoundingClientRect()
            return (
              image.left >= viewport.left - 1 &&
              image.right <= viewport.right + 1 &&
              Math.abs(
                (card.left + card.right - viewport.left - viewport.right) / 2
              ) < 2
            )
          })
        )
        .toBe(true)
      await testInfo.attach(`${width}-${name}`, {
        body: await preview.screenshot(),
        contentType: "image/png",
      })
    }
  })
}
