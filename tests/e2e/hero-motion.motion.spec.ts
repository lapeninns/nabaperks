import { expect, test } from "@playwright/test"

/**
 * The hero stamp loop, watched with motion actually enabled (MKT 01#17).
 *
 * This is the only spec in the suite that can see an animation at all: every
 * other project inherits `reducedMotion: "reduce"`, which short-circuits
 * `useStampJourneyLoop` before it schedules anything. A pause control that
 * silently did nothing would pass all four browser tiers and the a11y sweep.
 *
 * Reads the loop through the rendered stamp row rather than any test-only
 * attribute, so the assertion is about what a member sees.
 */

const CYCLE_MS = 520 + 3 * 780 + 420 + 2600

/** Distinct earned-stamp counts observed across slightly more than one cycle. */
async function observedStampCounts(
  page: import("@playwright/test").Page
): Promise<Set<number>> {
  const seen = new Set<number>()
  const samples = 24

  for (let index = 0; index < samples; index += 1) {
    seen.add(
      await page.evaluate(() => {
        // Scope to the hero card, not the page: /loyalty-for-pubs renders other
        // stamp rows and a page-wide count folds them in.
        const toggle = Array.from(document.querySelectorAll("button")).find(
          (button) => /the demo$/.test((button.textContent ?? "").trim())
        )
        let root = toggle?.parentElement ?? null

        while (root && !root.querySelector("[data-stamp-earned]")) {
          root = root.parentElement
        }

        return root?.querySelectorAll('[data-stamp-earned="true"]').length ?? -1
      })
    )
    await page.waitForTimeout(Math.round((CYCLE_MS * 1.2) / samples))
  }

  return seen
}

test.describe("hero sample card loop", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/loyalty-for-pubs")
    await page.waitForLoadState("networkidle")
  })

  test("animates, and the pause control genuinely stops it", async ({
    page,
  }) => {
    // The loop is running: the stamp row takes more than one value.
    const playing = await observedStampCounts(page)
    expect(playing.size).toBeGreaterThan(1)
    const finishedFrame = Math.max(...playing)

    await page.getByRole("button", { name: "Pause the demo" }).click()

    // Paused holds ONE frame, and it is the finished one — the same rest state
    // SSR and reduced motion render. Compared against the maximum actually
    // observed rather than a hard-coded total, so the assertion is about the
    // card's own completed frame whatever its stamp count.
    const paused = await observedStampCounts(page)
    expect(paused.size).toBe(1)
    expect([...paused][0]).toBe(finishedFrame)

    await page.getByRole("button", { name: "Play the demo" }).click()
    expect((await observedStampCounts(page)).size).toBeGreaterThan(1)
  })

  test("a paused loop does not keep advancing behind the frozen frame", async ({
    page,
  }) => {
    // The assertion that actually catches the original defect. Pausing used to
    // mask the hook's output with the finished frame while the loop kept
    // scheduling underneath, so the display froze either way — but `cycleIndex`
    // carried on, and the reward had silently moved on by the time anyone
    // pressed Play. Only the reward NAME exposes that, so this is the one check
    // that can tell a real pause from a painted-over one.
    const rewardName = () =>
      page.evaluate(() => {
        const toggle = Array.from(document.querySelectorAll("button")).find(
          (button) => /the demo$/.test((button.textContent ?? "").trim())
        )
        let root = toggle?.parentElement ?? null

        while (root && !root.querySelector("[data-stamp-earned]")) {
          root = root.parentElement
        }

        // The reward ticket only. The toggle's own label flips between "Pause"
        // and "Play", so a whole-card capture would always differ.
        const ticket = Array.from(root?.querySelectorAll("*") ?? []).find(
          (node) => /YOUR REWARD/i.test((node as HTMLElement).innerText ?? "")
        ) as HTMLElement | undefined

        return (ticket?.innerText ?? "").replace(/\s+/g, " ").trim()
      })

    await page.getByRole("button", { name: "Pause the demo" }).click()
    const before = await rewardName()

    // Long enough for two full cycles to have run had anything been scheduled.
    await page.waitForTimeout(CYCLE_MS * 2)

    expect(await rewardName()).toBe(before)

    await page.getByRole("button", { name: "Play the demo" }).click()

    // Read inside the opening pause beat, before the first legitimate advance.
    await page.waitForTimeout(800)
    expect(await rewardName()).toBe(before)
  })

  test("stops while scrolled out of view and restarts on return", async ({
    page,
  }) => {
    await page.evaluate(() => window.scrollTo(0, 4000))
    await page.waitForTimeout(600)

    const offScreen = await observedStampCounts(page)
    expect(offScreen.size).toBe(1)

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(600)

    expect((await observedStampCounts(page)).size).toBeGreaterThan(1)
  })
})
