import { expect, type Page } from "@playwright/test"

export type PageLayoutMetrics = {
  readonly bodyOverflow: number
  readonly clippedContentCount: number
  readonly documentOverflow: number
  readonly mainCount: number
  readonly outOfBoundsElementCount: number
  readonly outOfBoundsMainCount: number
  readonly viewportWidth: number
}

export const BREAKPOINT_EDGE_WIDTHS = [639, 640, 767, 768, 1023, 1024] as const

export const RESPONSIVE_VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone-landscape", width: 812, height: 375 },
] as const

export const LONG_COPY =
  "TheOldCrownGirtonLoyaltyProgrammeForNeighboursReturningAfterWorkAndAtWeekends".repeat(
    3
  )

export async function assertPageLayoutInvariants(
  page: Page
): Promise<PageLayoutMetrics> {
  const metrics = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const mainRegions = [...document.querySelectorAll("main")].filter(
      (element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        )
      }
    )
    const outOfBoundsMainCount = mainRegions.filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left < -1 || rect.right > viewportWidth + 1
    }).length
    const visibleMainElements = mainRegions.flatMap((main) =>
      [
        ...main.querySelectorAll<HTMLElement>(
          "h1, h2, h3, h4, p, span, a, button, label, input, select, textarea, td, th, [role='alert'], [role='status']"
        ),
      ].filter((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number.parseFloat(style.opacity) > 0 &&
          rect.width > 1 &&
          rect.height > 1 &&
          element.getAttribute("aria-hidden") !== "true"
        )
      })
    )
    const outOfBoundsElementCount = visibleMainElements.filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left < -1 || rect.right > viewportWidth + 1
    }).length
    const clippedContentCount = visibleMainElements.filter((element) => {
      const style = getComputedStyle(element)
      const clipsInlineContent =
        style.overflowX === "hidden" || style.overflowX === "clip"
      return clipsInlineContent && element.scrollWidth - element.clientWidth > 1
    }).length

    return {
      bodyOverflow: document.body.scrollWidth - viewportWidth,
      clippedContentCount,
      documentOverflow: document.documentElement.scrollWidth - viewportWidth,
      mainCount: mainRegions.length,
      outOfBoundsElementCount,
      outOfBoundsMainCount,
      viewportWidth,
    }
  })

  expect(metrics.viewportWidth).toBeGreaterThan(0)
  expect(metrics.mainCount).toBeGreaterThan(0)
  expect(metrics.documentOverflow).toBeLessThanOrEqual(1)
  expect(metrics.bodyOverflow).toBeLessThanOrEqual(1)
  expect(metrics.outOfBoundsMainCount).toBe(0)
  expect(metrics.outOfBoundsElementCount).toBe(0)
  expect(metrics.clippedContentCount).toBe(0)

  return metrics
}
