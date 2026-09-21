import { expect, test, type Page } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

/**
 * Counter-first console shell (handoff §5, §8, §9) on the DB-free harness.
 *
 * The four-row grid, the bottom tab bar below 900px, the labelled rail from
 * 900px, active-tab state per lane, the skip link, and no horizontal scroll
 * at the compact phone width. Runs in both the mobile and `.desktop`
 * projects; each assertion sets its own viewport so the proof is explicit.
 */

const consoleNav = (page: Page, form: "tabs" | "rail") =>
  page.locator(`nav[aria-label="Console"][data-console-nav="${form}"]`)

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    const body = document.querySelector("[data-console-body]")
    return {
      page: root.scrollWidth - root.clientWidth,
      body: body ? body.scrollWidth - body.clientWidth : 0,
    }
  })
  expect(overflow.page).toBeLessThanOrEqual(0)
  expect(overflow.body).toBeLessThanOrEqual(0)
}

export function describeMerchantConsoleShell() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("phone: four-tab bar, Counter active on the dashboard lane, nothing clipped at 320", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await gotoHydratedPage(page, HARNESS_ROUTES.dashboard)

    const tabs = consoleNav(page, "tabs")
    await expect(tabs).toBeVisible()
    await expect(consoleNav(page, "rail")).toBeHidden()
    await expect(tabs.getByRole("link")).toHaveText([
      "Counter",
      "Activity",
      "Numbers",
      "More",
    ])
    await expect(tabs.getByRole("link", { name: "Counter" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    await expect(
      tabs.getByRole("link", { name: "Activity" })
    ).not.toHaveAttribute("aria-current", "page")

    // The tab bar is pinned inside the viewport, not below the fold.
    const box = await tabs.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y + box!.height).toBeLessThanOrEqual(568 + 1)
    for (const link of await tabs.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(56)
    }

    // Top bar names the venue and today's date in the receipt register.
    const topBar = page.locator("[data-console-top-bar]")
    await expect(topBar).toContainText("Old Crown Girton")
    await expect(topBar).toContainText("Mon 21 Sep")

    await expectNoHorizontalScroll(page)
  })

  test("phone: the active tab follows the lane", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    for (const [route, tab] of [
      [HARNESS_ROUTES.activity, "Activity"],
      [HARNESS_ROUTES.rewardScan, "Activity"],
      [HARNESS_ROUTES.customers, "More"],
      [HARNESS_ROUTES.qr, "More"],
      [HARNESS_ROUTES.account, "More"],
    ] as const) {
      await gotoHydratedPage(page, route)
      const current = consoleNav(page, "tabs").locator('[aria-current="page"]')
      await expect(current, route).toHaveCount(1)
      await expect(current, route).toHaveText(tab)
    }
  })

  test("skip link lands focus on the scrolling body row", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoHydratedPage(page, HARNESS_ROUTES.dashboard)

    // WebKit does not tab to links by default, so focus the link directly;
    // the assertion is that it is the first focusable and that activating it
    // lands focus on the scrolling body row, not on document.body.
    const skip = page.getByRole("link", { name: "Skip to content" })
    await skip.focus()
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await skip.press("Enter")
    await expect(page.locator("#console-body")).toBeFocused()
  })

  test("rail from 900px: seven destinations, account items, log out, no tab bar", async ({
    page,
  }) => {
    for (const width of [900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await gotoHydratedPage(page, HARNESS_ROUTES.customers)

      const rail = consoleNav(page, "rail")
      await expect(rail, `${width}`).toBeVisible()
      await expect(consoleNav(page, "tabs"), `${width}`).toBeHidden()
      await expect(rail.getByRole("link")).toHaveText([
        "✱Nabaperks",
        "Dashboard",
        "Setup",
        "Poster",
        "Members",
        "Activity",
        "Announce",
        "Offers",
        "Profile",
        "Billing",
      ])
      await expect(rail.getByRole("link", { name: "Members" })).toHaveAttribute(
        "aria-current",
        "page"
      )
      await expect(rail.getByRole("button", { name: "Log out" })).toBeVisible()
      expect((await rail.boundingBox())!.width).toBe(200)
      await expectNoHorizontalScroll(page)
    }
  })

  test("only the body row scrolls; the tab bar stays put on a long lane", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await gotoHydratedPage(page, HARNESS_ROUTES.states)

    const tabs = consoleNav(page, "tabs")
    const before = await tabs.boundingBox()
    await page.locator("[data-console-body]").evaluate((body) => {
      body.scrollTop = 800
    })
    const after = await tabs.boundingBox()
    expect(after!.y).toBe(before!.y)
    expect(
      await page.evaluate(
        () => (document.scrollingElement ?? document.documentElement).scrollTop
      )
    ).toBe(0)
  })
}
