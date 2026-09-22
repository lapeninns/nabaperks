import type { Page, Response } from "@playwright/test"

/**
 * Shared helpers for the DB-free e2e tier (platform e2e harness).
 *
 * The `/dev/*` harness routes mount the REAL app shells + page bodies fed by
 * static fixtures and are gated by `NODE_ENV !== "production"` — so this tier is
 * deterministic, needs no Supabase, and runs against a dev server only.
 */

/**
 * Former install-prompt dismissal key. The prompt is gone; existing browser
 * specs still call dismissPwaInstall so they do not need a mechanical edit.
 */
export const PWA_DISMISS_KEY = "nabaperks:pwa-install-dismissed:v2"

/** DB-free `/dev` harness routes — the e2e DB-free tier surface. */
export const HARNESS_ROUTES = {
  dashboard: "/dev/app-harness/dashboard",
  customers: "/dev/app-harness/customers",
  invite: "/dev/app-harness/invite",
  activity: "/dev/app-harness/activity",
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
 * Retained so existing browser specs keep a stable init script. The install
 * prompt has been removed, so this no longer hides a control.
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
