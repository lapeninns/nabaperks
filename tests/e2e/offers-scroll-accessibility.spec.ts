import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"

const OFFERS_PATH = "/dev/app-harness/offers"
const OFFER_BENEFIT_RAIL = "section[aria-label='What an offer can give'] > ul"

type Viewport = {
  readonly width: number
  readonly height: number
}

const VIEWPORTS: readonly Viewport[] = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
]

async function tabToOfferBenefitRail(page: Page): Promise<void> {
  const rail = page.locator(OFFER_BENEFIT_RAIL)

  for (let index = 0; index < 32; index += 1) {
    await page.keyboard.press("Tab")

    if (await rail.evaluate((element) => document.activeElement === element)) {
      return
    }
  }

  await expect(rail).toBeFocused()
}

for (const viewport of VIEWPORTS) {
  test(`Given the offers harness at ${viewport.width}px When the benefit rail overflows Then keyboard users can reach and inspect it @a11y`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto(OFFERS_PATH)

    await expectNoAxeViolations(page, `${OFFERS_PATH} at ${viewport.width}px`)

    const rail = page.locator(OFFER_BENEFIT_RAIL)
    await expect(rail).toBeVisible()
    await expect(rail.locator("li")).toHaveCount(3)
    await tabToOfferBenefitRail(page)

    const dimensions = await rail.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))

    if (viewport.width === 375) {
      expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth)

      const before = await rail.evaluate((element) => element.scrollLeft)
      await page.keyboard.press("ArrowRight")
      await expect
        .poll(() => rail.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(before)
      await page.keyboard.press("ArrowLeft")
      await expect
        .poll(() => rail.evaluate((element) => element.scrollLeft))
        .toBeLessThanOrEqual(before)
      return
    }

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
    await expect(rail.locator("li").last()).toBeInViewport()
  })
}
