import type { Page, Response } from "@playwright/test"

/**
 * Shared helpers for the DB-free e2e tier (platform e2e harness).
 *
 * The `/dev/*` harness routes mount the REAL app shells + page bodies fed by
 * static fixtures and are gated by `NODE_ENV !== "production"` — so this tier is
 * deterministic, needs no Supabase, and runs against a dev server only.
 */

/** PWA install prompt dismissal key — components/pwa/app-pwa.tsx. */
export const PWA_DISMISS_KEY = "nabaperks:pwa-install-dismissed:v2"

/** DB-free `/dev` harness routes — the e2e DB-free tier surface. */
export const HARNESS_ROUTES = {
  dashboard: "/dev/app-harness/dashboard",
  customers: "/dev/app-harness/customers",
  invite: "/dev/app-harness/invite",
  activity: "/dev/app-harness/activity",
  numbers: "/dev/app-harness/numbers",
  more: "/dev/app-harness/more",
  account: "/dev/app-harness/account",
  qr: "/dev/app-harness/qr",
  scan: "/dev/app-harness/scan",
  rewardScan: "/dev/app-harness/reward-scan",
  sendReward: "/dev/app-harness/send-reward",
  launch: "/dev/app-harness/launch",
  announcements: "/dev/app-harness/announcements",
  offers: "/dev/app-harness/offers",
  onboarding: "/dev/app-harness/onboarding",
  pilotNote: "/dev/app-harness/pilot-note",
  skeletons: "/dev/app-harness/skeletons",
  states: "/dev/app-harness/states",
  trial: "/dev/app-harness/trial",
  trialAdmin: "/dev/app-harness/trial/admin",
  designSystem: "/dev/design-system",
  posterPreview: "/dev/poster-preview",
  tentPreview: "/dev/tent-preview",
} as const

/**
 * Pre-dismiss the PWA install prompt so it never intercepts navigation or
 * clicks during an e2e run (platform e2e harness H-8). Register before the
 * first `page.goto`; the init script runs on every document in the context.
 */
export async function dismissPwaInstall(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    try {
      window.localStorage.setItem(key, "1")
    } catch {
      // Storage can be unavailable in some contexts; harness nav still works.
    }
  }, PWA_DISMISS_KEY)
}

export async function gotoHydratedPage(
  page: Page,
  path: string
): Promise<Response | null> {
  const response = await page.goto(path)
  await waitForHydratedPage(page)
  return response
}

export async function waitForHydratedPage(page: Page): Promise<void> {
  await page
    .locator(
      "html[data-playwright-harness='true'][data-playwright-hydrated='true'] body:not([inert])"
    )
    .waitFor({ state: "attached", timeout: 15_000 })
}

/**
 * The merchant console shell is a fixed-height grid whose body row scrolls,
 * so a `fullPage` screenshot of a harness lane would only show the first
 * screen. Before a full-page capture, let the shell grow with its content
 * (as the print stylesheet does) so the baseline still reviews the whole
 * lane. The `@visual console breakpoints` cases capture the shell itself at
 * viewport size and do not use this.
 */
export async function expandConsoleShellForFullPage(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "[data-console-shell]{display:block!important;height:auto!important;min-height:0!important}" +
      "[data-console-body]{overflow:visible!important}" +
      "[data-console-pin]{position:static!important}",
  })
}
