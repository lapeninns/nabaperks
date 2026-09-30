import { expect, test, type Page } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  disposableUkMobile,
  openTermsStep,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

/**
 * QA BUG-049 (WCAG 2.2 SC 2.4.11 Focus Not Obscured): on a short viewport
 * the join terms step's sticky action bar covered the legal links and the
 * consent checkboxes when they took keyboard focus, because nothing reserved
 * the bar's height when the browser scrolled a focused control into view.
 * Every Tab stop above the bar must end up wholly above it. Nothing is
 * submitted, so no membership is written.
 */
type FocusStop = {
  readonly label: string
  readonly insideBar: boolean
  readonly top: number
  readonly bottom: number
  readonly barTop: number
}

async function readFocusStop(page: Page): Promise<FocusStop | undefined> {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement) || el === document.body) return undefined
    // The bar is the sticky ancestor of the step's submit button.
    let bar: Element | null = document.querySelector(
      "form button[type='submit']"
    )
    while (bar && getComputedStyle(bar).position !== "sticky") {
      bar = bar.parentElement
    }
    if (!bar) throw new Error("sticky join action bar not found")
    const rect = el.getBoundingClientRect()
    return {
      label: (
        el.getAttribute("aria-label") ||
        el.textContent ||
        el.id ||
        el.tagName
      )
        .trim()
        .slice(0, 60),
      insideBar: bar.contains(el),
      top: rect.top,
      bottom: rect.bottom,
      barTop: bar.getBoundingClientRect().top,
    }
  })
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 640, height: 360 },
]) {
  test.describe(`@customer-flow @a11y join terms focus ${viewport.width}x${viewport.height}`, () => {
    const reason = customerReadbackLiveDbSkipReason()
    test.skip(Boolean(reason), reason)
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("keyboard focus is never hidden behind the sticky action bar", async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName !== "chromium",
        "WebKit and Firefox on macOS do not Tab to links and buttons by default"
      )
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: PublicQrRouterFixture | undefined
      const phone = disposableUkMobile()

      try {
        fixture = await createPublicQrRouterFixture(sql)
        test.skip(!fixture, "seed merchant owner is not available")
        if (!fixture) return

        await openTermsStep(page, fixture, phone)
        await page.evaluate(() => {
          window.scrollTo(0, 0)
          ;(document.activeElement as HTMLElement | null)?.blur()
        })

        const heading = page.getByRole("heading", {
          name: "Collect your first stamp",
        })
        await heading.click()

        const seen: FocusStop[] = []
        for (let press = 0; press < 20; press += 1) {
          await page.keyboard.press("Tab")
          const stop = await readFocusStop(page)
          if (!stop) continue
          if (stop.insideBar) break
          seen.push(stop)
        }

        expect(
          seen.length,
          "Tab reached controls above the bar"
        ).toBeGreaterThan(2)
        const hidden = seen.filter((stop) => stop.bottom > stop.barTop + 0.5)
        expect(
          hidden.map(
            (stop) =>
              `${stop.label}: bottom ${Math.round(stop.bottom)} > bar top ${Math.round(stop.barTop)}`
          )
        ).toEqual([])
      } finally {
        await cleanupCustomerJoinRows(sql, fixture, phone)
        await cleanupPublicQrRouterFixture(sql, fixture)
        await sql.end()
      }
    })
  })
}
