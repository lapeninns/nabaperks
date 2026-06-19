import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]

const surfaces = [
  { name: "home", path: "/", expected: "Nabaperks" },
  {
    name: "pricing",
    path: "/pricing",
    expected: "One price. The whole machine.",
  },
  {
    name: "merchant unavailable",
    path: "/m/missing-merchant",
    expected: "Page not found",
  },
  {
    name: "customer qr unavailable",
    path: "/q/missing-qr",
    expected: "Card unavailable",
  },
  {
    name: "customer join preview",
    path: "/dev/customer-flow/preview/join-hero",
    expected: "Keep your card on your phone",
  },
  {
    name: "customer reward preview",
    path: "/dev/customer-flow/preview/reward-ready",
    expected: "Customer reward",
  },
  {
    name: "launch preview",
    path: "/dev/launch-preview/live-kit",
    expected: "Launch kit",
  },
  {
    name: "merchant dashboard preview",
    path: "/dev/merchant-admin-preview/merchant-dashboard",
    expected: "Merchant dashboard",
  },
  {
    name: "admin customers preview",
    path: "/dev/merchant-admin-preview/admin-customers",
    expected: "Admin customers",
  },
  {
    name: "admin fraud empty preview",
    path: "/dev/merchant-admin-preview/admin-fraud-empty",
    expected: "Admin fraud (empty)",
  },
  {
    name: "design system",
    path: "/dev/design-system",
    expected: "Design system catalog",
  },
  { name: "offline", path: "/offline", expected: "You're offline" },
  { name: "not found", path: "/missing-route", expected: "Page not found" },
] as const

async function expectNoViolations(page: Page, label: string): Promise<void> {
  await hideDevelopmentOverlay(page)
  await page.waitForTimeout(500)

  const { violations } = await new AxeBuilder({ page })
    .exclude("nextjs-portal")
    .exclude("[data-nextjs-dev-overlay='true']")
    .exclude('aside[aria-label="Install Nabaperks"]')
    .withTags(WCAG_TAGS)
    .analyze()

  expect(
    violations,
    `${label} a11y violations:\n${violations.map(formatViolation).join("\n\n")}`
  ).toEqual([])
}

test.describe("accessibility (WCAG 2 A/AA)", () => {
  for (const surface of surfaces) {
    test(`${surface.name} has no automated violations`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto(surface.path)

      if (surface.name === "customer reward preview") {
        await expect(
          page.locator(
            '[data-customer-flow-preview="reward-ready"][data-screen-label="Customer reward"]'
          )
        ).toBeVisible()
      } else if (surface.name === "merchant dashboard preview") {
        await expect(
          page.locator(
            '[data-ma-preview="merchant-dashboard"][data-screen-label="Merchant dashboard"]'
          )
        ).toBeVisible()
      } else if (surface.name === "admin customers preview") {
        await expect(
          page.locator(
            '[data-ma-preview="admin-customers"][data-screen-label="Admin customers"]'
          )
        ).toBeVisible()
      } else if (surface.name === "admin fraud empty preview") {
        await expect(
          page.locator(
            '[data-ma-preview="admin-fraud-empty"][data-screen-label="Admin fraud (empty)"]'
          )
        ).toBeVisible()
        // The empty variant must actually render the route's EmptyState copy,
        // not a broken table shell, before axe analyses it. `DataTable` renders
        // the empty state in both the mobile and desktop branches (one is
        // CSS-hidden), so match the first.
        await expect(page.getByText("No fraud flags yet").first()).toBeVisible()
      } else {
        await expect(page.getByText(surface.expected).first()).toBeVisible()
      }

      await expectNoViolations(page, surface.name)
    })
  }
})

// Floating overlays that are not part of the surface UI under test: the Next.js
// dev overlay, plus the PWA "Install Nabaperks / Add to Home Screen" hint, which
// floats over content at the iPhone width this project emulates. The hint's
// production component (components/pwa/app-pwa.tsx) always renders its root as
// `<aside aria-label="Install Nabaperks">`.
const NON_CONSOLE_OVERLAY_SELECTORS =
  'nextjs-portal, [data-nextjs-dev-overlay="true"], aside[aria-label="Install Nabaperks"]'

// Dismissal flag the install-hint component already honours on mount; setting it
// makes the component unmount itself. Test-only — no production code is changed.
const PWA_INSTALL_DISMISS_KEY = "nabaperks:pwa-install-dismissed:v2"

async function hideDevelopmentOverlay(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      ${NON_CONSOLE_OVERLAY_SELECTORS} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  })

  await page.evaluate(
    ({ selectors, dismissKey }) => {
      try {
        window.localStorage.setItem(dismissKey, "1")
      } catch {
        // localStorage may be unavailable; the CSS above still hides the hint.
      }

      for (const element of document.querySelectorAll(selectors)) {
        element.setAttribute("aria-hidden", "true")

        if (element instanceof HTMLElement) {
          element.style.display = "none"
          element.style.visibility = "hidden"
        }
      }
    },
    {
      selectors: NON_CONSOLE_OVERLAY_SELECTORS,
      dismissKey: PWA_INSTALL_DISMISS_KEY,
    }
  )
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
