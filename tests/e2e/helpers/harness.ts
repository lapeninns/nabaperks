import type { Page } from "@playwright/test"

/**
 * Shared helpers for the DB-free e2e tier (MS-platform-e2e-harness).
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
  activity: "/dev/app-harness/activity",
  account: "/dev/app-harness/account",
  qr: "/dev/app-harness/qr",
  scan: "/dev/app-harness/scan",
  rewardScan: "/dev/app-harness/reward-scan",
  launch: "/dev/app-harness/launch",
  announcements: "/dev/app-harness/announcements",
  onboarding: "/dev/app-harness/onboarding",
  skeletons: "/dev/app-harness/skeletons",
  states: "/dev/app-harness/states",
  designSystem: "/dev/design-system",
  posterPreview: "/dev/poster-preview",
} as const

/**
 * Pre-dismiss the PWA install prompt so it never intercepts navigation or
 * clicks during an e2e run (MS-platform-e2e-harness H-8). Register before the
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
): Promise<void> {
  await page.goto(path)
  await page
    .locator("html[data-playwright-hydrated='true']")
    .waitFor({ state: "attached" })
}
