import { expect, test } from "@playwright/test"

import { assertVisualLayoutInvariants } from "../helpers/visual-layout"

const DASHBOARD_PATH = "/dev/app-harness/dashboard"
const DASHBOARD_BREAKPOINT_WIDTHS = [639, 640, 767, 768, 1023, 1024] as const
const DASHBOARD_VIEWPORT_HEIGHT = 844 as const
const DESKTOP_NAV_BREAKPOINT = 768 as const
const RESPONSIVE_VIEWPORTS = [
  { height: 812, label: "mobile", width: 375 },
  { height: 1024, label: "tablet-portrait", width: 768 },
  { height: 768, label: "tablet-landscape", width: 1024 },
  { height: 900, label: "desktop", width: 1280 },
] as const
const REFLOW_VIEWPORTS = [
  { factor: 2, height: 900, width: 640 },
  { factor: 4, height: 900, width: 320 },
] as const
const LONG_COPY_FIXTURE =
  "NabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksLongCopyNabaperksX"

test.describe("visual layout invariants @visual", () => {
  test("Given dashboard breakpoint edges When the real shell renders Then bounds and the 768px menu branch remain physical", async ({
    page,
  }) => {
    for (const width of DASHBOARD_BREAKPOINT_WIDTHS) {
      await page.setViewportSize({
        width,
        height: DASHBOARD_VIEWPORT_HEIGHT,
      })
      await page.goto(DASHBOARD_PATH)

      const metrics = await assertVisualLayoutInvariants(page)
      expect(metrics.viewportWidth).toBe(width)

      const mobileMenu = page.getByRole("button", { name: "Open menu" })
      const desktopMenu = page.getByRole("button", {
        name: "Toggle navigation",
      })

      if (width < DESKTOP_NAV_BREAKPOINT) {
        await expect(mobileMenu).toBeVisible()
        await expect(desktopMenu).toBeHidden()
      } else {
        await expect(mobileMenu).toBeHidden()
        await expect(desktopMenu).toBeVisible()
      }
    }
  })

  test("Given a 231-character unbroken heading When it replaces the real dashboard heading Then the fixture and page stay inside physical bounds", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(DASHBOARD_PATH)
    expect(LONG_COPY_FIXTURE).toHaveLength(231)

    const injectedValue = await page.evaluate((longCopy) => {
      const heading = document.querySelector("h1")

      if (!heading) return null

      heading.dataset.visualLongCopyFixture = "true"
      heading.textContent = longCopy

      return heading.textContent
    }, LONG_COPY_FIXTURE)

    expect(injectedValue).toBe(LONG_COPY_FIXTURE)

    const fixture = page.locator('h1[data-visual-long-copy-fixture="true"]')
    await expect(fixture).toBeVisible()
    await expect(fixture).toHaveText(LONG_COPY_FIXTURE)
    const [fixtureBounds, layoutMetrics] = await Promise.all([
      fixture.evaluate((heading) => {
        const bounds = heading.getBoundingClientRect()

        return { height: bounds.height, left: bounds.left, right: bounds.right }
      }),
      assertVisualLayoutInvariants(page),
    ])

    expect(fixtureBounds.height).toBeGreaterThan(0)
    expect(fixtureBounds.left).toBeGreaterThanOrEqual(-1)
    expect(fixtureBounds.right).toBeLessThanOrEqual(
      layoutMetrics.viewportWidth + 1
    )
  })

  test("Given overflow-hidden content When the physical invariant runs Then concealed horizontal overflow is rejected", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(DASHBOARD_PATH)

    await page.locator("main").evaluate((main) => {
      const host = document.createElement("div")
      host.dataset.visualOverflowFixture = "true"
      host.style.width = "100px"
      host.style.overflowX = "hidden"
      host.style.whiteSpace = "nowrap"
      host.textContent = "Concealed overflow fixture that exceeds its host"
      main.prepend(host)
    })

    await expect(assertVisualLayoutInvariants(page)).rejects.toThrow(
      /hidden horizontal overflow: \[data-visual-overflow-fixture="true"\]/i
    )
  })

  test("Given the required mobile, tablet, landscape and desktop viewports When the dashboard renders Then every physical layout is bounded", async ({
    page,
  }, testInfo) => {
    for (const viewport of RESPONSIVE_VIEWPORTS) {
      await page.setViewportSize(viewport)
      const response = await page.goto(DASHBOARD_PATH)

      expect(response?.status(), `${viewport.label} document status`).toBe(200)
      const metrics = await assertVisualLayoutInvariants(page)
      expect(metrics.viewportWidth).toBe(viewport.width)

      if (viewport.label === "mobile") {
        const menuButton = page.getByRole("button", { name: "Open menu" })
        await menuButton.click()
        await expect(
          page.locator('[data-slot="sidebar-trigger"][aria-label="Open menu"]')
        ).toHaveAttribute("aria-expanded", "true")
        await page.keyboard.press("Escape")
        await expect(
          page.getByRole("button", { name: "Open menu" })
        ).toHaveAttribute("aria-expanded", "false")
      }

      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`${viewport.label}.png`),
      })
    }
  })

  test("Given dormant dark tokens When the design catalogue activates night printing Then the palette changes without breaking layout", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/dev/design-system")
    const lightBackground = await page
      .locator("body")
      .evaluate((body) => window.getComputedStyle(body).backgroundColor)

    const themeToggle = page.getByRole("button", { name: "Night printing" })
    await expect(themeToggle).toBeEnabled()
    await themeToggle.click()
    await expect(
      page.getByRole("button", { name: "Back to daylight" })
    ).toHaveAttribute("aria-pressed", "true")
    await expect(page.locator("html")).toHaveClass(/dark/)
    const darkBackground = await page
      .locator("body")
      .evaluate((body) => window.getComputedStyle(body).backgroundColor)

    expect(darkBackground).not.toBe(lightBackground)
    const darkLayout = await page.locator("body").evaluate((body) => ({
      documentOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      height: body.getBoundingClientRect().height,
      width: body.getBoundingClientRect().width,
    }))
    expect(darkLayout.documentOverflow).toBeLessThanOrEqual(1)
    expect(darkLayout.width).toBeGreaterThan(0)
    expect(darkLayout.height).toBeGreaterThan(0)
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("dark-dashboard.png"),
    })
  })

  test("Given 200% and 400% reflow equivalents When the dashboard renders Then content remains physically discoverable @a11y", async ({
    page,
  }, testInfo) => {
    for (const viewport of REFLOW_VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto(DASHBOARD_PATH)

      const metrics = await assertVisualLayoutInvariants(page)
      expect(metrics.viewportWidth * viewport.factor).toBe(1280)
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`reflow-${viewport.factor}00-percent.png`),
      })
    }
  })

  test("Given the loading and error harness routes When their real states render Then both stay within physical bounds", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 })

    for (const state of ["skeletons", "states"] as const) {
      const response = await page.goto(`/dev/app-harness/${state}`)

      expect(response?.status(), `${state} document status`).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await assertVisualLayoutInvariants(page)
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`${state}-mobile.png`),
      })
    }
  })
})
