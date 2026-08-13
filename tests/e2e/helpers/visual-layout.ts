import { expect, type Page } from "@playwright/test"

const LAYOUT_TOLERANCE_PX = 1 as const

type VisualLayoutMetrics = {
  readonly bodyOverflow: number
  readonly documentOverflow: number
  readonly hiddenHorizontalOverflow: readonly string[]
  readonly mainHeight: number
  readonly mainLeft: number
  readonly mainRight: number
  readonly mainWidth: number
  readonly viewportHeight: number
  readonly viewportWidth: number
}

export async function assertVisualLayoutInvariants(
  page: Page
): Promise<VisualLayoutMetrics> {
  const metrics = await page.evaluate((layoutTolerancePx) => {
    const main = document.querySelector("main")

    if (!main) return null

    const mainBounds = main.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    const hiddenHorizontalOverflow = Array.from(
      main.querySelectorAll<HTMLElement>("*")
    ).flatMap((element) => {
      if (element.matches(".sr-only")) return []

      const style = window.getComputedStyle(element)
      const bounds = element.getBoundingClientRect()
      const isTextLeaf =
        element.childElementCount === 0 &&
        element.textContent?.trim() !== "" &&
        style.textOverflow !== "ellipsis" &&
        style.webkitLineClamp === "none"
      if (!isTextLeaf || bounds.width <= 0 || bounds.height <= 0) {
        return []
      }

      let clippingAncestor: HTMLElement | null = element
      while (clippingAncestor && main.contains(clippingAncestor)) {
        const ancestorStyle = window.getComputedStyle(clippingAncestor)
        const ancestorBounds = clippingAncestor.getBoundingClientRect()
        const concealsOverflow =
          ancestorStyle.overflowX === "hidden" ||
          ancestorStyle.overflowX === "clip"
        const descendantEscapes =
          bounds.left < ancestorBounds.left - layoutTolerancePx ||
          bounds.right > ancestorBounds.right + layoutTolerancePx
        const directTextEscapes =
          clippingAncestor === element &&
          element.scrollWidth - element.clientWidth > layoutTolerancePx

        if (concealsOverflow && (descendantEscapes || directTextEscapes)) break
        clippingAncestor = clippingAncestor.parentElement
      }

      if (!clippingAncestor || !main.contains(clippingAncestor)) return []

      const label = (() => {
        if (clippingAncestor.dataset.visualOverflowFixture) {
          return `[data-visual-overflow-fixture="${clippingAncestor.dataset.visualOverflowFixture}"]`
        }

        const classLabel = clippingAncestor.className
          .trim()
          .split(/\s+/)
          .slice(0, 3)
          .join(".")
        return `${clippingAncestor.tagName.toLowerCase()}${classLabel ? `.${classLabel}` : ""}[text-overflow=${style.textOverflow};line-clamp=${style.webkitLineClamp}]`
      })()

      return [label]
    })
    return {
      bodyOverflow: Math.max(document.body.scrollWidth - viewportWidth, 0),
      documentOverflow: Math.max(
        document.documentElement.scrollWidth - viewportWidth,
        0
      ),
      hiddenHorizontalOverflow,
      mainHeight: mainBounds.height,
      mainLeft: mainBounds.left,
      mainRight: mainBounds.right,
      mainWidth: mainBounds.width,
      viewportHeight: document.documentElement.clientHeight,
      viewportWidth,
    }
  }, LAYOUT_TOLERANCE_PX)

  expect(metrics, "the real page has one primary main landmark").not.toBeNull()

  if (!metrics) {
    throw new Error("Expected a primary main landmark for visual layout proof.")
  }

  expect(metrics.viewportWidth, "viewport width is positive").toBeGreaterThan(0)
  expect(metrics.viewportHeight, "viewport height is positive").toBeGreaterThan(
    0
  )
  expect(metrics.mainWidth, "main width is positive").toBeGreaterThan(0)
  expect(metrics.mainHeight, "main height is positive").toBeGreaterThan(0)
  expect(
    metrics.bodyOverflow,
    "body has no hidden horizontal overflow"
  ).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX)
  expect(
    metrics.documentOverflow,
    "document has no hidden horizontal overflow"
  ).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX)
  expect(
    metrics.hiddenHorizontalOverflow,
    `elements have no hidden horizontal overflow: ${metrics.hiddenHorizontalOverflow.join(", ")}`
  ).toEqual([])
  expect(
    metrics.mainLeft,
    "main does not extend beyond the left viewport edge"
  ).toBeGreaterThanOrEqual(-LAYOUT_TOLERANCE_PX)
  expect(
    metrics.mainRight,
    "main does not extend beyond the right viewport edge"
  ).toBeLessThanOrEqual(metrics.viewportWidth + LAYOUT_TOLERANCE_PX)

  return metrics
}
