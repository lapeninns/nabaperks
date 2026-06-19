/**
 * Registry for the auth-gated merchant (`/app/*`) and admin (`/admin/*`) console
 * preview harness. Mirrors `customer-flow-preview` and `launch-preview`: the
 * redesigned console UI can be screenshotted and axe-tested with Playwright
 * without a hosted Supabase session, because the real presentation components
 * render against the mock data wired up in the `/dev` screens.
 *
 * Pure data — no React, no `server-only`, no Supabase/DB/network — so the e2e
 * spec and Vitest can import it in plain Node without tripping the server-only
 * boundary. Every real non-redirect console surface is a `kind: "screen"` entry
 * with screenshot evidence; the legacy redirect routes are recorded as
 * `kind: "redirect"` entries (their behaviour is proven by route tests, not by
 * fabricating a fake screen).
 */

export type MerchantAdminConsole = "merchant" | "admin"

export type MerchantAdminPreviewKind = "screen" | "redirect"

/**
 * Which UI state a `kind: "screen"` surface stands in for. `"populated"` is the
 * happy-path render with mock data (the default — omitted on most entries);
 * `"empty"`, `"loading"`, and `"error"` prove the mobile-first state coverage
 * (zero-data EmptyState, route skeletons, and the `'use client'` error boundary)
 * inside the real console shell so the screenshot/a11y specs catch layout jump
 * or overflow at 375px.
 */
export type MerchantAdminPreviewVariant =
  | "populated"
  | "empty"
  | "loading"
  | "error"

type MerchantAdminPreviewEntry = {
  id: string
  console: MerchantAdminConsole
  /** The real authenticated route this surface stands in for. */
  route: string
  /** Human label echoed onto the screen anchor for screenshot/a11y specs. */
  screenLabel: string
  /** Screenshot evidence path, namespaced by console (e.g. `merchant/01-...`). */
  screenshot: string
  kind: MerchantAdminPreviewKind
  /** Set only for `kind: "redirect"` surfaces — the route they forward to. */
  redirectsTo?: string
  /**
   * State a `kind: "screen"` surface renders. Defaults to `"populated"` when
   * omitted; state-coverage surfaces set `"empty" | "loading" | "error"`.
   */
  variant?: MerchantAdminPreviewVariant
}

export const MERCHANT_ADMIN_PREVIEW_SURFACES = [
  // Merchant console — real screens.
  {
    id: "merchant-dashboard",
    console: "merchant",
    route: "/app",
    screenLabel: "Merchant dashboard",
    screenshot: "merchant/01-dashboard.png",
    kind: "screen",
  },
  {
    id: "merchant-account",
    console: "merchant",
    route: "/app/account",
    screenLabel: "Merchant account",
    screenshot: "merchant/02-account.png",
    kind: "screen",
  },
  {
    id: "merchant-activity",
    console: "merchant",
    route: "/app/activity",
    screenLabel: "Merchant activity",
    screenshot: "merchant/03-activity.png",
    kind: "screen",
  },
  {
    id: "merchant-customers",
    console: "merchant",
    route: "/app/customers",
    screenLabel: "Merchant customers",
    screenshot: "merchant/04-customers.png",
    kind: "screen",
  },
  {
    id: "merchant-launch",
    console: "merchant",
    route: "/app/launch",
    screenLabel: "Merchant launch",
    screenshot: "merchant/05-launch.png",
    kind: "screen",
  },
  {
    id: "merchant-onboarding",
    console: "merchant",
    route: "/app/onboarding",
    screenLabel: "Merchant onboarding",
    screenshot: "merchant/06-onboarding.png",
    kind: "screen",
  },
  {
    id: "merchant-reward-scan",
    console: "merchant",
    route: "/app/rewards/scan/[rewardId]",
    screenLabel: "Merchant reward collection",
    screenshot: "merchant/07-reward-scan.png",
    kind: "screen",
  },
  // Merchant console — legacy redirect routes.
  {
    id: "merchant-billing",
    console: "merchant",
    route: "/app/billing",
    screenLabel: "Merchant billing redirect",
    screenshot: "merchant/redirect-billing.png",
    kind: "redirect",
    redirectsTo: "/app/account?tab=billing",
  },
  {
    id: "merchant-settings",
    console: "merchant",
    route: "/app/settings",
    screenLabel: "Merchant settings redirect",
    screenshot: "merchant/redirect-settings.png",
    kind: "redirect",
    redirectsTo: "/app/account",
  },
  {
    id: "merchant-profile",
    console: "merchant",
    route: "/app/profile",
    screenLabel: "Merchant profile redirect",
    screenshot: "merchant/redirect-profile.png",
    kind: "redirect",
    redirectsTo: "/app/account?tab=profile",
  },
  // Admin console — real screens.
  {
    id: "admin-hub",
    console: "admin",
    route: "/admin",
    screenLabel: "Admin console",
    screenshot: "admin/01-hub.png",
    kind: "screen",
  },
  {
    id: "admin-pilot",
    console: "admin",
    route: "/admin/pilot",
    screenLabel: "Admin pilot readiness",
    screenshot: "admin/02-pilot.png",
    kind: "screen",
  },
  {
    id: "admin-merchants",
    console: "admin",
    route: "/admin/merchants",
    screenLabel: "Admin merchants",
    screenshot: "admin/03-merchants.png",
    kind: "screen",
  },
  {
    id: "admin-customers",
    console: "admin",
    route: "/admin/customers",
    screenLabel: "Admin customers",
    screenshot: "admin/04-customers.png",
    kind: "screen",
  },
  {
    id: "admin-billing",
    console: "admin",
    route: "/admin/billing",
    screenLabel: "Admin billing",
    screenshot: "admin/05-billing.png",
    kind: "screen",
  },
  {
    id: "admin-privacy",
    console: "admin",
    route: "/admin/privacy",
    screenLabel: "Admin privacy support",
    screenshot: "admin/06-privacy.png",
    kind: "screen",
  },
  {
    id: "admin-fraud",
    console: "admin",
    route: "/admin/fraud",
    screenLabel: "Admin fraud",
    screenshot: "admin/07-fraud.png",
    kind: "screen",
  },
  {
    id: "admin-audit",
    console: "admin",
    route: "/admin/audit",
    screenLabel: "Admin audit logs",
    screenshot: "admin/08-audit.png",
    kind: "screen",
  },
  // ── State coverage ─────────────────────────────────────────────────────────
  // Empty-data variants of the data-heavy surfaces: the same real screens with
  // `rows = []`, so each renders its route's real EmptyState (no broken table
  // shell or layout collapse) inside the shell at mobile width.
  {
    id: "merchant-customers-empty",
    console: "merchant",
    route: "/app/customers",
    screenLabel: "Merchant customers (empty)",
    screenshot: "merchant/state-customers-empty.png",
    kind: "screen",
    variant: "empty",
  },
  {
    id: "merchant-activity-empty",
    console: "merchant",
    route: "/app/activity",
    screenLabel: "Merchant activity (empty)",
    screenshot: "merchant/state-activity-empty.png",
    kind: "screen",
    variant: "empty",
  },
  {
    id: "admin-customers-empty",
    console: "admin",
    route: "/admin/customers",
    screenLabel: "Admin customers (empty)",
    screenshot: "admin/state-customers-empty.png",
    kind: "screen",
    variant: "empty",
  },
  {
    id: "admin-fraud-empty",
    console: "admin",
    route: "/admin/fraud",
    screenLabel: "Admin fraud (empty)",
    screenshot: "admin/state-fraud-empty.png",
    kind: "screen",
    variant: "empty",
  },
  {
    id: "admin-merchants-empty",
    console: "admin",
    route: "/admin/merchants",
    screenLabel: "Admin merchants (empty)",
    screenshot: "admin/state-merchants-empty.png",
    kind: "screen",
    variant: "empty",
  },
  // Loading variants: the real route/section skeletons rendered inside the shell,
  // proving skeleton dimensions do not cause a layout jump or overflow at 375px.
  {
    id: "merchant-dashboard-loading",
    console: "merchant",
    route: "/app",
    screenLabel: "Merchant dashboard (loading)",
    screenshot: "merchant/state-dashboard-loading.png",
    kind: "screen",
    variant: "loading",
  },
  {
    id: "admin-customers-loading",
    console: "admin",
    route: "/admin/customers",
    screenLabel: "Admin customers (loading)",
    screenshot: "admin/state-customers-loading.png",
    kind: "screen",
    variant: "loading",
  },
  // Error variants: the `'use client'` route error boundaries rendered with a
  // mock error + no-op reset, proving they stay mobile-clean (Wet Ink, reachable
  // recovery action, no overflow) inside the shell.
  {
    id: "merchant-error",
    console: "merchant",
    route: "/app",
    screenLabel: "Merchant error",
    screenshot: "merchant/state-error.png",
    kind: "screen",
    variant: "error",
  },
  {
    id: "admin-error",
    console: "admin",
    route: "/admin",
    screenLabel: "Admin error",
    screenshot: "admin/state-error.png",
    kind: "screen",
    variant: "error",
  },
] as const satisfies readonly MerchantAdminPreviewEntry[]

export type MerchantAdminPreviewSurface =
  (typeof MERCHANT_ADMIN_PREVIEW_SURFACES)[number]

export type MerchantAdminPreviewSurfaceId = MerchantAdminPreviewSurface["id"]

export type MerchantAdminPreviewScreen = Extract<
  MerchantAdminPreviewSurface,
  { kind: "screen" }
>

export type MerchantAdminPreviewScreenId = MerchantAdminPreviewScreen["id"]

/** Screen-only surfaces (excludes redirects) — what the screenshot specs walk. */
export const MERCHANT_ADMIN_PREVIEW_SCREENS =
  MERCHANT_ADMIN_PREVIEW_SURFACES.filter(
    (surface): surface is MerchantAdminPreviewScreen =>
      surface.kind === "screen"
  )

const surfaceIds = new Set<string>(
  MERCHANT_ADMIN_PREVIEW_SURFACES.map((surface) => surface.id)
)

export function previewPath(id: MerchantAdminPreviewSurfaceId): string {
  return `/dev/merchant-admin-preview/${id}`
}

export function isMerchantAdminPreviewSurfaceId(
  value: string
): value is MerchantAdminPreviewSurfaceId {
  return surfaceIds.has(value)
}

export function merchantAdminPreviewSurface(
  id: MerchantAdminPreviewSurfaceId
): MerchantAdminPreviewSurface {
  const surface = MERCHANT_ADMIN_PREVIEW_SURFACES.find(
    (entry) => entry.id === id
  )

  if (!surface) {
    throw new Error(`Unknown merchant/admin preview surface: ${id}`)
  }

  return surface
}

export function isMerchantAdminPreviewScreenId(
  value: string
): value is MerchantAdminPreviewScreenId {
  return MERCHANT_ADMIN_PREVIEW_SCREENS.some((screen) => screen.id === value)
}

/**
 * The state a surface renders, defaulting to `"populated"`. Populated entries
 * omit `variant` (so `as const` narrows them to a shape without the field);
 * this reads it uniformly without per-member narrowing. The screen dispatcher
 * and tests use this instead of touching `surface.variant` directly.
 */
export function merchantAdminPreviewVariant(
  surface: MerchantAdminPreviewSurface
): MerchantAdminPreviewVariant {
  const { variant } = surface as { variant?: MerchantAdminPreviewVariant }
  return variant ?? "populated"
}
