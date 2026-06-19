import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

/**
 * Shared accessibility helper for the e2e suite. Runs an axe-core scan with the
 * WCAG 2 A/AA tag set against the current page, after hiding the Next.js
 * development overlay so its dev-only markup never pollutes the audit. Centralised
 * here so every surface-coverage spec asserts the same gate as a11y.spec.ts.
 */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]

export async function expectNoAxeViolations(
  page: Page,
  label: string
): Promise<void> {
  await hideDevelopmentOverlay(page)
  await page.waitForTimeout(500)

  const { violations } = await new AxeBuilder({ page })
    .exclude("nextjs-portal")
    .exclude("[data-nextjs-dev-overlay='true']")
    .withTags(WCAG_TAGS)
    .analyze()

  expect(
    violations,
    `${label} a11y violations:\n${violations.map(formatViolation).join("\n\n")}`
  ).toEqual([])
}

export async function hideDevelopmentOverlay(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-dev-overlay="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  })

  await page.evaluate(() => {
    const selectors = "nextjs-portal, [data-nextjs-dev-overlay='true']"

    for (const element of document.querySelectorAll(selectors)) {
      element.setAttribute("aria-hidden", "true")

      if (element instanceof HTMLElement) {
        element.style.display = "none"
        element.style.visibility = "hidden"
      }
    }
  })
}

function formatViolation(violation: {
  id: string
  impact?: unknown
  help: string
  nodes: { target: unknown; failureSummary?: string }[]
}): string {
  const targets = violation.nodes
    .slice(0, 3)
    .map((node) => `${formatTarget(node.target)}: ${node.failureSummary ?? ""}`)
    .join("\n")

  return `${violation.id} [${violation.impact ?? "unknown"}] ${violation.help}\n${targets}`
}

function formatTarget(target: unknown): string {
  if (Array.isArray(target)) {
    return target
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
      .join(", ")
  }

  return typeof target === "string" ? target : JSON.stringify(target)
}
