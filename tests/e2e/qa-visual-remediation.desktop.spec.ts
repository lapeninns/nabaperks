import { expect, test } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440] as const

test.beforeEach(async ({ page }) => {
  await dismissPwaInstall(page)
  await page.emulateMedia({ reducedMotion: "reduce" })
})

for (const theme of ["light", "dark"] as const) {
  for (const route of ["/", "/pricing", "/loyalty-for-pubs"] as const) {
    test(`${route} ${theme} keeps meaningful text within clipping ancestors`, async ({
      page,
    }) => {
      await page.addInitScript(
        (value) => localStorage.setItem("nabaperks-theme", value),
        theme
      )
      await gotoHydratedPage(page, route)
      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${theme}\\b`)
      )
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 })
        await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width)
        const scope =
          route === "/loyalty-for-pubs"
            ? page.locator("main")
            : page.locator("[data-takeover-enquiry]")
        const clipped = await scope.evaluate(async (root) => {
          await document.fonts.ready
          return [
            ...root.querySelectorAll(
              "p,h2,h3,a,[data-slot='badge']>span,dd,dt"
            ),
          ]
            .filter((element) => {
              if (
                !element.getClientRects().length ||
                element.closest(".sr-only,[data-slot='table-container']")
              )
                return false
              const range = document.createRange()
              range.selectNodeContents(element)
              const glyph = range.getBoundingClientRect()
              if (glyph.left < -1 || glyph.right > innerWidth + 1) return true
              for (
                let parent = element.parentElement;
                parent;
                parent = parent.parentElement
              ) {
                const style = getComputedStyle(parent)
                const box = parent.getBoundingClientRect()
                if (
                  ["hidden", "clip"].includes(style.overflowX) &&
                  (glyph.left < box.left - 1 || glyph.right > box.right + 1)
                )
                  return true
                if (
                  parent.matches("[data-slot='badge']") &&
                  ["hidden", "clip"].includes(style.overflowY) &&
                  (glyph.top < box.top - 1 || glyph.bottom > box.bottom + 1)
                )
                  return true
              }
              return false
            })
            .map((element) => element.textContent)
        })
        expect(clipped, `${route} ${theme} ${width}px`).toEqual([])
        if (route !== "/loyalty-for-pubs") {
          const ratio = await scope
            .locator("p")
            .first()
            .evaluate((price) => {
              const luminance = (css: string) => {
                const values = css.match(/\d+/g)?.slice(0, 3).map(Number) ?? []
                const linear = values.map((value) => {
                  const channel = value / 255
                  return channel <= 0.04045
                    ? channel / 12.92
                    : ((channel + 0.055) / 1.055) ** 2.4
                })
                return (
                  0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
                )
              }
              const card = price.closest("aside")
              if (!card) throw new Error("Takeover card missing")
              const foreground = luminance(getComputedStyle(price).color)
              const background = luminance(
                getComputedStyle(card).backgroundColor
              )
              return (
                (Math.max(foreground, background) + 0.05) /
                (Math.min(foreground, background) + 0.05)
              )
            })
          expect(ratio).toBeGreaterThanOrEqual(3)
        }
      }
    })
  }
}

test("takeover enquiries and guide comparison remain operable by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 })
  for (const route of ["/", "/pricing"]) {
    await gotoHydratedPage(page, route)
    const enquiry = page.locator("[data-takeover-enquiry] a")
    await enquiry.focus()
    await expect(enquiry).toBeFocused()
    await enquiry.press("Enter")
    await expect(page).toHaveURL(/\/demo$/)
  }
  await page.setViewportSize({ width: 1024, height: 844 })
  await gotoHydratedPage(page, "/loyalty-for-pubs")
  const comparison = page.locator("[data-slot='table-container']")
  await comparison.focus()
  await expect(comparison).toBeFocused()
  const before = await comparison.evaluate((element) => element.scrollLeft)
  const maximum = await comparison.evaluate(
    (element) => element.scrollWidth - element.clientWidth
  )
  expect(maximum).toBeGreaterThan(0)
  for (let step = 0; step < 12; step += 1) await comparison.press("ArrowRight")
  await expect
    .poll(() => comparison.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(before)
  await expect
    .poll(() => comparison.evaluate((element) => element.scrollLeft))
    .toBeGreaterThanOrEqual(maximum - 1)
  await expect(comparison.locator("tbody tr")).toHaveCount(5)
  await expect(comparison.locator("thead th")).toHaveCount(5)
})

test("inverted enquiry cards pass scoped WCAG checks in both themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 })
  for (const theme of ["light", "dark"]) {
    await gotoHydratedPage(page, "/")
    await page.evaluate(
      (value) => localStorage.setItem("nabaperks-theme", value),
      theme
    )
    for (const route of ["/", "/pricing"]) {
      await gotoHydratedPage(page, route)
      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${theme}\\b`)
      )
      const results = await new AxeBuilder({ page })
        .include("[data-takeover-enquiry]")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
      expect(results.violations, `${route} ${theme}`).toEqual([])
    }
  }
})

for (const range of [7, 14]) {
  for (const detail of [false, true]) {
    test(`${range}-day ${detail ? "single" : "paired"} charts keep readable dates and complete data`, async ({
      page,
    }) => {
      await gotoHydratedPage(
        page,
        `/dev/app-harness/numbers${detail ? "/stamps" : ""}?range=${range}`
      )
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 })
        const charts = page.locator("[data-column-chart]")
        await expect(charts).toHaveCount(detail ? 1 : 2)
        for (const chart of await charts.all()) {
          await expect(chart.locator("tbody tr")).toHaveCount(range)
          await expect
            .poll(async () =>
              chart.locator("[data-column-captions]").evaluate(async (row) => {
                await document.fonts.ready
                const labels = [...row.children].filter(
                  (label) => getComputedStyle(label).visibility === "visible"
                )
                const bounds = labels.map((label) => {
                  const selection = document.createRange()
                  selection.selectNodeContents(label)
                  return selection.getBoundingClientRect()
                })
                const first = row.firstElementChild
                const last = row.lastElementChild
                return (
                  Boolean(
                    first &&
                    last &&
                    labels.includes(first) &&
                    labels.includes(last)
                  ) &&
                  bounds.every(
                    (bound, index) =>
                      index === 0 || bound.left >= bounds[index - 1].right + 7.5
                  )
                )
              })
            )
            .toBe(true)
        }
      }
    })
  }
}
