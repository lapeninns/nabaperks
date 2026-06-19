import type { ReactNode } from "react"

import { AdminShell } from "@/components/layout/admin-shell"
import { MerchantAppShell } from "@/components/layout/merchant-app-shell"
import {
  merchantAdminPreviewSurface,
  type MerchantAdminPreviewScreenId,
} from "@/lib/dev/merchant-admin-preview"

import { AdminAuditScreen } from "./admin-audit"
import { AdminBillingScreen } from "./admin-billing"
import { AdminCustomersScreen } from "./admin-customers"
import { AdminFraudScreen } from "./admin-fraud"
import { AdminHubScreen } from "./admin-hub"
import { AdminMerchantsScreen } from "./admin-merchants"
import { AdminPilotScreen } from "./admin-pilot"
import { AdminPrivacyScreen } from "./admin-privacy"
import { AdminErrorScreen, MerchantErrorScreen } from "./error-screens"
import {
  AdminCustomersLoadingScreen,
  MerchantDashboardLoadingScreen,
} from "./loading-screens"
import { MerchantAccountScreen } from "./merchant-account"
import { MerchantActivityScreen } from "./merchant-activity"
import { MerchantCustomersScreen } from "./merchant-customers"
import { MerchantDashboardScreen } from "./merchant-dashboard"
import { MerchantLaunchScreen } from "./merchant-launch"
import { MerchantOnboardingScreen } from "./merchant-onboarding"
import { MerchantRewardScanScreen } from "./merchant-reward-scan"

/**
 * No-op sign-out action handed to the merchant shell. The preview never mutates
 * anything; the shell only needs a valid form `action`, so this satisfies the
 * type without touching auth.
 */
async function previewSignOutAction() {
  "use server"
}

/**
 * Wraps the real merchant shell chrome so the redesigned navigation/header is
 * captured by screenshot/a11y specs alongside the page body. `activePath` is the
 * surface's real `/app/*` route, so the nav highlights the matching tab without
 * the preview ever navigating there.
 */
function MerchantPreviewShell({
  children,
  activePath,
}: {
  children: ReactNode
  activePath: string
}) {
  return (
    <MerchantAppShell
      signOutAction={previewSignOutAction}
      activePath={activePath}
    >
      {children}
    </MerchantAppShell>
  )
}

/**
 * Wraps the real admin shell chrome with a sample operator identity. `activePath`
 * is the surface's real `/admin/*` route, so the nav highlights the matching tab.
 */
function AdminPreviewShell({
  children,
  activePath,
}: {
  children: ReactNode
  activePath: string
}) {
  return (
    <AdminShell
      operatorEmail="ops@nabaperks.example"
      mfaRequired={false}
      activePath={activePath}
    >
      {children}
    </AdminShell>
  )
}

const SCREEN_BODY: Record<MerchantAdminPreviewScreenId, ReactNode> = {
  "merchant-dashboard": <MerchantDashboardScreen />,
  "merchant-account": <MerchantAccountScreen />,
  "merchant-activity": <MerchantActivityScreen />,
  "merchant-customers": <MerchantCustomersScreen />,
  "merchant-launch": <MerchantLaunchScreen />,
  "merchant-onboarding": <MerchantOnboardingScreen />,
  "merchant-reward-scan": <MerchantRewardScanScreen />,
  "admin-hub": <AdminHubScreen />,
  "admin-pilot": <AdminPilotScreen />,
  "admin-merchants": <AdminMerchantsScreen />,
  "admin-customers": <AdminCustomersScreen />,
  "admin-billing": <AdminBillingScreen />,
  "admin-privacy": <AdminPrivacyScreen />,
  "admin-fraud": <AdminFraudScreen />,
  "admin-audit": <AdminAuditScreen />,
  // ── State coverage ──────────────────────────────────────────────────────────
  // Empty: the same screens with `empty` so they render their real EmptyState.
  "merchant-customers-empty": <MerchantCustomersScreen empty />,
  "merchant-activity-empty": <MerchantActivityScreen empty />,
  "admin-customers-empty": <AdminCustomersScreen empty />,
  "admin-fraud-empty": <AdminFraudScreen empty />,
  "admin-merchants-empty": <AdminMerchantsScreen empty />,
  // Loading: real route skeletons inside the shell.
  "merchant-dashboard-loading": <MerchantDashboardLoadingScreen />,
  "admin-customers-loading": <AdminCustomersLoadingScreen />,
  // Error: real route error boundaries with a mock error + no-op reset.
  "merchant-error": <MerchantErrorScreen />,
  "admin-error": <AdminErrorScreen />,
}

/**
 * Dispatcher for the merchant/admin console preview harness. Renders the real
 * shell chrome for the surface's console, the per-surface screen body, and the
 * `data-ma-preview` / `data-screen-label` anchors the screenshot and a11y specs
 * assert against (the same anchor convention as `launch-preview`).
 */
export function MerchantAdminPreviewScreen({
  surfaceId,
}: {
  surfaceId: MerchantAdminPreviewScreenId
}) {
  const surface = merchantAdminPreviewSurface(surfaceId)
  const body = SCREEN_BODY[surfaceId]

  const shelled =
    surface.console === "merchant" ? (
      <MerchantPreviewShell activePath={surface.route}>
        {body}
      </MerchantPreviewShell>
    ) : (
      <AdminPreviewShell activePath={surface.route}>{body}</AdminPreviewShell>
    )

  return (
    <div data-ma-preview={surface.id} data-screen-label={surface.screenLabel}>
      {shelled}
    </div>
  )
}
