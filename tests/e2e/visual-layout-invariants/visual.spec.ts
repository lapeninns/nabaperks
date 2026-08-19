import { expect, test } from "@playwright/test"

import { gotoHydratedPage } from "../helpers/harness"
import {
  assertPageLayoutInvariants,
  BREAKPOINT_EDGE_WIDTHS,
  LONG_COPY,
  RESPONSIVE_VIEWPORTS,
} from "../helpers/visual-layout"

const DASHBOARD_PATH = "/dev/app-harness/dashboard"
const LOADING_PATH = "/dev/app-harness/skeletons"
const ERROR_PATH = "/dev/app-harness/states#error-banners"

test.describe("visual layout invariants @visual", () => {
  for (const width of BREAKPOINT_EDGE_WIDTHS) {
    test(`Given the dashboard at ${width}px When it renders Then the breakpoint edge stays bounded`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await gotoHydratedPage(page, DASHBOARD_PATH)

      await assertPageLayoutInvariants(page)

      const mobileMenu = page.getByRole("button", { name: "Open menu" })
      const desktopMenu = page.getByRole("button", {
        name: "Toggle navigation",
      })
      if (width < 768) {
        await expect(mobileMenu).toBeVisible()
        await expect(desktopMenu).toBeHidden()
      } else {
        await expect(mobileMenu).toBeHidden()
        await expect(desktopMenu).toBeVisible()
      }
    })
  }

  test("Given adversarial unbroken venue copy When the phone dashboard renders Then the copy and page stay bounded", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoHydratedPage(page, DASHBOARD_PATH)

    const title = page.getByRole("heading", { level: 1 })
    await title.evaluate((element, copy) => {
      element.textContent = copy
    }, LONG_COPY)

    await expect(title).toHaveText(LONG_COPY)
    const titleOverflow = await title.evaluate(
      (element) => element.scrollWidth - element.clientWidth
    )
    expect(titleOverflow).toBeLessThanOrEqual(1)
    await assertPageLayoutInvariants(page)
  })

  test("Given overflow is clipped by an ancestor When layout invariants run Then the concealed failure is rejected", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoHydratedPage(page, DASHBOARD_PATH)
    await page.locator("main").evaluate((main) => {
      const clip = document.createElement("div")
      clip.style.overflowX = "clip"
      clip.style.width = "100%"
      const overflow = document.createElement("div")
      overflow.dataset.visualOverflowProbe = "true"
      overflow.style.width = "calc(100vw + 80px)"
      const content = document.createElement("span")
      content.style.display = "block"
      content.style.width = "100%"
      content.textContent = "concealed horizontal overflow"
      overflow.append(content)
      clip.append(overflow)
      main.append(clip)
    })

    await expect(assertPageLayoutInvariants(page)).rejects.toThrow()
  })

  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`Given the dashboard at ${viewport.name} dimensions When it renders Then its layout reflows without clipping`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await gotoHydratedPage(page, DASHBOARD_PATH)

      await assertPageLayoutInvariants(page)
    })
  }

  test("Given dark theme is active When the dashboard renders Then the night-printing tokens and layout are visible", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("nabaperks-theme", "dark")
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoHydratedPage(page, DASHBOARD_PATH)

    await expect(page.locator("html")).toHaveClass(/dark/)
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.documentElement).backgroundColor
        )
      )
      .not.toBe("rgb(246, 241, 230)")
    await assertPageLayoutInvariants(page)
    await page.screenshot({
      path: testInfo.outputPath("dashboard-dark.png"),
      fullPage: true,
    })
  })

  for (const state of [
    { name: "loading", path: LOADING_PATH, heading: "Loading skeletons" },
    {
      name: "error",
      path: ERROR_PATH,
      heading: "Error fixtures — the real StatusBanner load-failure surfaces",
    },
  ] as const) {
    test(`Given the ${state.name} harness When it renders Then the dedicated state stays visible and bounded`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await gotoHydratedPage(page, state.path)

      await expect(
        page.getByRole("heading", { name: state.heading })
      ).toBeVisible()
      await assertPageLayoutInvariants(page)
      await page.screenshot({
        path: testInfo.outputPath(`${state.name}-state.png`),
        fullPage: true,
      })
    })
  }

  test("Given a phone safe area When the dashboard renders Then fixed chrome remains inside the visual viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoHydratedPage(page, DASHBOARD_PATH)

    const mobileHeader = page.locator("header").first()
    await expect(mobileHeader).toBeVisible()
    const safeArea = await mobileHeader.evaluate((header) => {
      const rect = header.getBoundingClientRect()
      const visualViewport = window.visualViewport
      return {
        bottom: rect.bottom,
        top: rect.top,
        paddingTop: Number.parseFloat(getComputedStyle(header).paddingTop),
        visualBottom:
          (visualViewport?.offsetTop ?? 0) +
          (visualViewport?.height ?? window.innerHeight),
        visualTop: visualViewport?.offsetTop ?? 0,
      }
    })
    expect(safeArea.top).toBeGreaterThanOrEqual(safeArea.visualTop)
    expect(safeArea.bottom).toBeLessThanOrEqual(safeArea.visualBottom)
    expect(safeArea.paddingTop).toBeGreaterThanOrEqual(8)
    await assertPageLayoutInvariants(page)
  })

  test("Given forced colours are active When keyboard focus enters the dashboard Then the exact journey stays visible and bounded", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ forcedColors: "active" })
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoHydratedPage(page, DASHBOARD_PATH)

    await expect
      .poll(() =>
        page.evaluate(() => matchMedia("(forced-colors: active)").matches)
      )
      .toBe(true)
    const menu = page.getByRole("button", { name: "Open menu" })
    await menu.focus()
    await expect(menu).toBeFocused()
    const focusIndicator = await menu.evaluate((button) => {
      const style = getComputedStyle(button)
      return Math.max(
        Number.parseFloat(style.outlineWidth),
        Number.parseFloat(style.borderWidth)
      )
    })
    expect(focusIndicator).toBeGreaterThan(0)
    await assertPageLayoutInvariants(page)
    await page.screenshot({
      path: testInfo.outputPath("dashboard-forced-colours.png"),
      fullPage: true,
    })
  })

  for (const zoom of [
    { percent: 200, width: 640 },
    { percent: 400, width: 320 },
  ] as const) {
    test(`Given an equivalent ${zoom.percent}% reflow viewport When long copy renders Then content remains available without hidden overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: zoom.width, height: 900 })
      await gotoHydratedPage(page, DASHBOARD_PATH)

      const title = page.getByRole("heading", { level: 1 })
      await title.evaluate((element, copy) => {
        element.textContent = copy
      }, LONG_COPY)
      await expect(title).toHaveText(LONG_COPY)
      await assertPageLayoutInvariants(page)
    })
  }
})
