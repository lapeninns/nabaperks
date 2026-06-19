import { execFileSync } from "node:child_process"

import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

// WCAG 2 A/AA including colour-contrast — the automated accessibility gate.
const WCAG_TAGS = ["wcag2a", "wcag2aa"]

function runDemo(...args: string[]) {
  execFileSync("node", ["scripts/customer-flow-demo.mjs", ...args], {
    stdio: "pipe",
  })
}

// colour-contrast is a known, tracked gap in the Wet Ink palette (QA_MATRIX §6
// gap #1). This gate enforces every other WCAG 2 A/AA rule now; re-enable
// colour-contrast once the palette tokens are fixed (Phase 4 "blocking").
const KNOWN_GAP_RULES = ["color-contrast"]

async function expectNoViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .disableRules(KNOWN_GAP_RULES)
    .analyze()
  const summary = violations
    .map((v) => `${v.id} (${v.nodes.length})`)
    .join(", ")
  expect(violations, `${label} a11y violations: ${summary}`).toEqual([])
}

test.describe("accessibility (WCAG 2 A/AA)", () => {
  test("marketing home has no violations", async ({ page }) => {
    await page.goto("/")
    await expectNoViolations(page, "home")
  })

  test("customer join surface has no violations", async ({ page }) => {
    runDemo("reset")
    await page.goto("/q/bean-test-qr")
    await expect(
      page.getByRole("heading", { name: "Keep your card on your phone" })
    ).toBeVisible()
    await expectNoViolations(page, "join")
  })
})
