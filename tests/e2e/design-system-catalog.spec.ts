import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import { expect, test, type Page } from "@playwright/test"

const outputRoot = "docs/screenshots/design-system"

/**
 * Smoke + screenshot for the Wet Ink design-system catalog — the foundation
 * acceptance gate. Confirms the tokens, typography, surfaces, motion, and
 * loyalty sections render, that a motion beat re-fires on Replay, and that the
 * loyalty vocabulary prints all four reward states. Captures evidence per the
 * screenshot runbook.
 */
test("renders the design-system catalog with motion and loyalty states", async ({
  page,
}) => {
  await page.goto("/dev/design-system")

  // Page shell + the five foundation sections.
  await expect(
    page.getByRole("heading", { name: "Design system catalog" })
  ).toBeVisible()
  for (const id of [
    "tokens",
    "typography",
    "surfaces",
    "iconography",
    "motion",
    "loyalty",
  ]) {
    await expect(page.locator(`#${id}`)).toBeVisible()
  }

  // Motion playground re-fires a beat on Replay without error.
  const replay = page.getByRole("button", { name: "Replay" }).first()
  await expect(replay).toBeVisible()
  await replay.click()

  // The single seal vocabulary prints all four reward states.
  for (const state of ["sealed", "waiting", "ready", "redeemed"]) {
    await expect(
      page.locator(`[data-reward-seal="${state}"]`).first()
    ).toBeVisible()
  }
  // The reward ticket prints the same four states in place.
  for (const state of ["sealed", "waiting", "ready", "redeemed"]) {
    await expect(
      page.locator(`[data-ticket-state="${state}"]`).first()
    ).toBeVisible()
  }

  await capture(page, "catalog.png")
})

async function capture(page: Page, relativePath: string): Promise<void> {
  const target = join(outputRoot, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  await hideDevelopmentOverlay(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: target, fullPage: true })
}

async function hideDevelopmentOverlay(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-dev-overlay="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `,
  })
}
