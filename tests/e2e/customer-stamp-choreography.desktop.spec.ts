import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

const HARNESS = "/dev/home-harness/stamp"
const LONG_TASK_THRESHOLD_MS = 50
const INTERACTION_TASK_BUDGET_MS = 100

type StampMetrics = {
  layoutShift: number
  longTasks: number[]
}

async function installMetrics(page: Page) {
  await page.addInitScript(() => {
    const metrics: StampMetrics = { layoutShift: 0, longTasks: [] }
    const target = window as Window & { __stampMetrics?: StampMetrics }
    target.__stampMetrics = metrics

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number
          hadRecentInput: boolean
        }
        if (!shift.hadRecentInput) metrics.layoutShift += shift.value
      }
    }).observe({ type: "layout-shift", buffered: true })

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        metrics.longTasks.push(entry.duration)
      }
    }).observe({ type: "longtask", buffered: true })
  })
}

test.use({ contextOptions: { reducedMotion: "no-preference" } })

test.describe("customer stamp choreography — normal motion", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
    await installMetrics(page)
  })

  test("keeps pending truthful, the target stable, and prints once", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?mode=success&delay=700`)
    const root = page.locator("[data-stamp-phase]")
    const button = page.locator("[data-stamp-press-button]")
    await button.scrollIntoViewIfNeeded()
    const initialBox = await button.boundingBox()
    expect(initialBox).not.toBeNull()

    await button.evaluate((element) => {
      const target = window as Window & { __stampButton?: Element }
      target.__stampButton = element
    })
    await expect(
      root.getByRole("list", { name: /3 of 5 stamps earned/ })
    ).toBeVisible()
    await page.evaluate(() => {
      const target = window as Window & { __stampMetrics?: StampMetrics }
      if (target.__stampMetrics) {
        target.__stampMetrics.layoutShift = 0
        target.__stampMetrics.longTasks = []
      }
      performance.clearMarks()
    })

    await button.click()
    await expect(root).toHaveAttribute("data-stamp-phase", "checking")
    await expect(
      root.getByRole("list", { name: /3 of 5 stamps earned/ })
    ).toBeVisible()
    await expect(
      root.locator('[role="list"] [data-stamp-earned=true]')
    ).toHaveCount(3)
    await expect(
      root.getByRole("button", { name: "Checking today's stamp" })
    ).toHaveAttribute("aria-busy", "true")

    const checkingBox = await button.boundingBox()
    expect(checkingBox).toEqual(initialBox)
    expect(
      await button.evaluate((element) => {
        const target = window as Window & { __stampButton?: Element }
        return target.__stampButton === element
      })
    ).toBe(true)

    await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
    await expect(
      root.getByRole("list", { name: /4 of 5 stamps earned/ })
    ).toBeVisible()
    await expect(
      root.locator('[role="list"] [data-stamp-earned=true]')
    ).toHaveCount(4)
    await expect(root.getByText("Stamp 4 of 5 added.")).toBeVisible()

    expect(await button.boundingBox()).toEqual(initialBox)
    expect(
      await button.evaluate((element) => {
        const target = window as Window & { __stampButton?: Element }
        return target.__stampButton === element
      })
    ).toBe(true)

    const marks = await page.evaluate(() =>
      performance
        .getEntriesByType("mark")
        .filter((entry) => entry.name.startsWith("nabaperks:stamp:"))
        .map((entry) => entry.name)
    )
    expect(marks).toEqual([
      "nabaperks:stamp:checking",
      "nabaperks:stamp:request",
      "nabaperks:stamp:issued",
      "nabaperks:stamp:settled",
    ])

    const metrics = await page.evaluate(() => {
      const target = window as Window & { __stampMetrics?: StampMetrics }
      return target.__stampMetrics
    })
    expect(metrics?.layoutShift ?? 1).toBeLessThan(0.001)
    const longTasks =
      metrics?.longTasks.filter(
        (duration) => duration > LONG_TASK_THRESHOLD_MS
      ) ?? []
    // Hosted runners can cross the Long Tasks API boundary by a few
    // milliseconds. Keep the interaction well inside the 200 ms "good" INP
    // boundary while still failing repeated or genuinely blocking work.
    expect(longTasks.length).toBeLessThanOrEqual(1)
    expect(Math.max(0, ...longTasks)).toBeLessThan(INTERACTION_TASK_BUDGET_MS)
  })

  test("reveals the full-card reward and durable CTA in place", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?mode=final&delay=180`)
    const root = page.locator("[data-stamp-phase]")

    await root.getByRole("button", { name: "Add today's stamp" }).click()
    await expect(
      root.getByRole("list", { name: /4 of 5 stamps earned/ })
    ).toBeVisible()
    await expect(root).toHaveAttribute("data-stamp-phase", "printing")
    await expect(
      root.locator('[data-stamp-earned="true"][data-slammed="true"]')
    ).toHaveAttribute("aria-label", /Stamp 5 earned/)
    await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
    await expect(
      root.getByRole("list", { name: /5 of 5 stamps earned/ })
    ).toBeVisible()
    await expect(
      root.getByRole("img", { name: "Mystery reward, unlocked" })
    ).toBeVisible()
    await expect(root.getByText("That's the full card.")).toBeVisible()
    await expect(root.locator('[data-ticket-state="waiting"]')).toBeVisible()
    await expect(
      page.getByRole("link", { name: "See your reward" })
    ).toBeVisible()
    await expect(root.locator('[role="status"]')).toHaveCount(1)
    await expect(page.locator("[data-refresh-count]")).toHaveText("1")
  })

  test("supports a first retry after a returned block", async ({ page }) => {
    await page.goto(`${HARNESS}?mode=blocked&delay=40`)
    const root = page.locator("[data-stamp-phase]")

    await root.getByRole("button", { name: "Add today's stamp" }).click()
    await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
    await expect(
      root.getByRole("list", { name: /3 of 5 stamps earned/ })
    ).toBeVisible()
    await root.getByRole("button", { name: "Try today's stamp again" }).click()
    await expect(page.locator("[data-submit-count]")).toHaveText("2")
  })

  test("holds once without remounting or double-submitting", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?mode=success&delay=500`)
    const button = page.locator("[data-stamp-press-button]")
    await button.scrollIntoViewIfNeeded()
    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    await button.evaluate((element) => {
      const target = window as Window & { __stampButton?: Element }
      target.__stampButton = element
    })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(650)
    expect(await button.boundingBox()).toEqual(box)
    expect(
      await button.evaluate((element) => {
        const target = window as Window & { __stampButton?: Element }
        return target.__stampButton === element
      })
    ).toBe(true)
    await page.mouse.up()

    await expect(page.locator("[data-submit-count]")).toHaveText("1")
    await expect(page.locator("[data-stamp-phase]")).toHaveAttribute(
      "data-stamp-phase",
      "confirmed"
    )
    await expect(page.locator("[data-submit-count]")).toHaveText("1")
  })

  test("deduplicates two activations in the same render turn", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?mode=success&delay=500`)
    const button = page.locator("[data-stamp-press-button]")

    await button.evaluate((element) => {
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error("Stamp target is not a button")
      }
      element.click()
      element.click()
    })

    await expect(page.locator("[data-submit-count]")).toHaveText("1")
    await expect(page.locator("[data-stamp-phase]")).toHaveAttribute(
      "data-stamp-phase",
      "confirmed"
    )
    await expect(page.locator("[data-submit-count]")).toHaveText("1")
  })

  test("treats a transport failure as unknown and requests readback", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?mode=unknown&delay=40`)
    const root = page.locator("[data-stamp-phase]")

    await root.getByRole("button", { name: "Add today's stamp" }).click()
    await expect(page.locator("[data-refresh-count]")).toHaveText("1")
    await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
    await expect(root).toContainText("We couldn't confirm the stamp.")
    await expect(
      root.getByRole("button", { name: "Try today's stamp again" })
    ).toBeVisible()
  })

  test("prints the recovered venue stamp after an issued readback", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?mode=unknown-issued-bonus&delay=40`)
    const root = page.locator("[data-stamp-phase]")

    await root.getByRole("button", { name: "Add today's stamp" }).click()
    await expect(root).toHaveAttribute("data-stamp-phase", "printing")
    await expect(
      root.locator('[data-stamp-earned="true"][data-slammed="true"]')
    ).toHaveAttribute("aria-label", /Stamp 3 earned/)
    await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
    await expect(page.locator("[data-refresh-count]")).toHaveText("1")
  })

  test("does not invent success when readback closes without a count increase", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?mode=unknown-closed&delay=40`)
    const root = page.locator("[data-stamp-phase]")

    await root.getByRole("button", { name: "Add today's stamp" }).click()
    await expect(root).toHaveAttribute("data-stamp-phase", "closed")
    await expect(
      root.getByRole("list", { name: /3 of 5 stamps earned/ })
    ).toBeVisible()
    await expect(root).toContainText("No new stamp was confirmed.")
    await expect(root).not.toContainText("Stamp 3 of 5 added.")
  })

  test("keeps the unlocked ticket revealed on a reloaded completed card", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?mode=reloaded-final`)
    const root = page.locator("[data-stamp-phase]")

    await expect(root).toHaveAttribute("data-stamp-phase", "idle")
    await expect(
      root.getByRole("list", { name: /5 of 5 stamps earned/ })
    ).toBeVisible()
    await expect(
      root.getByRole("img", { name: "Mystery reward, unlocked" })
    ).toBeVisible()
    await expect(root.locator('[data-ticket-state="waiting"]')).toBeVisible()
    await expect(root.getByText("Your reward is ready to open.")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "See your reward" })
    ).toBeVisible()
  })
})
