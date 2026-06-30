/**
 * Pure launch-readiness domain logic — no I/O, no `server-only`, no Supabase.
 *
 * Everything here is a deterministic function of already-loaded setup data, so
 * it is unit-testable in isolation (see tests/unit/launch-readiness-core). The
 * server-only data layer (`./launch-readiness.ts`) loads the inputs and
 * re-exports this module's API; components keep importing from there.
 *
 * Type-only imports of the QR summaries are erased at build time, so this module
 * never pulls the `server-only` qr-code module into a bundle at runtime.
 */
import {
  LAUNCH_CHECKLIST_STEP_ORDER,
  LAUNCH_MIN_ACTIVE_REWARDS,
  LAUNCH_SETUP_STEP_LABELS,
} from "@/lib/merchant/launch-readiness-contract"
import type {
  LaunchChecklistStepId,
  LaunchHubTab,
  LaunchReadinessTab,
  LaunchSetupStepId,
} from "@/lib/merchant/launch-readiness-contract"
import { QR_LAUNCH_TAB_PATH, QR_POSTER_PATH } from "@/lib/merchant/qr-nav"
import type { ActiveCardSummary, QrCodeSummary } from "@/lib/merchant/qr-code"

export type { LaunchSetupStepId, LaunchReadinessTab, LaunchHubTab }

export type LaunchReadinessStep = {
  id: LaunchSetupStepId | "qr"
  tab: LaunchReadinessTab
  label: string
  ready: boolean
  href: string
  actionLabel: string
}

export type LaunchReadinessAction = {
  id: LaunchChecklistStepId
  tab: LaunchReadinessTab | "billing"
  label: string
  ready: boolean
  href: string
  actionLabel: string
}

export type LaunchReadiness = {
  steps: LaunchReadinessStep[]
  checklist: LaunchReadinessAction[]
  completed: number
  total: number
  launchReady: boolean
  nextStep: LaunchReadinessAction | null
  tabs: Record<LaunchReadinessTab, boolean>
}

export type LaunchLocation = {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  geofence_radius_meters: number
  require_geofence: boolean
  geocoded_at: string | null
} | null

export type LaunchBilling = {
  requiresBilling: boolean
  status: string | null
}

export type BuildLaunchReadinessInput = {
  activeCard: ActiveCardSummary | null
  activeRewardPoolItemCount: number
  qrCode: QrCodeSummary | null
  location: LaunchLocation
  billing?: LaunchBilling
}

export function buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount,
  qrCode,
  location,
  billing,
}: BuildLaunchReadinessInput): LaunchReadiness {
  const cardReady = activeCard !== null
  const rewardsReady = activeRewardPoolItemCount >= LAUNCH_MIN_ACTIVE_REWARDS
  const venueReady = isVenueReady(location)
  const qrReady = qrCode?.is_active === true
  const billingReady = isBillingReady(billing)
  const stepById = {
    venue: {
      id: "venue" as const,
      tab: "venue" as const,
      label: LAUNCH_SETUP_STEP_LABELS.venue,
      ready: venueReady,
      href: "/app/launch?tab=venue",
      actionLabel: "Save venue",
    },
    card: {
      id: "card" as const,
      tab: "card" as const,
      label: LAUNCH_SETUP_STEP_LABELS.card,
      ready: cardReady,
      href: "/app/launch?tab=card",
      actionLabel: cardActionLabel(cardReady),
    },
    rewards: {
      id: "rewards" as const,
      tab: "rewards" as const,
      label: LAUNCH_SETUP_STEP_LABELS.rewards,
      ready: rewardsReady,
      href: "/app/launch?tab=rewards",
      actionLabel: "Add rewards",
    },
    qr: {
      id: "qr" as const,
      tab: "qr" as const,
      label: LAUNCH_SETUP_STEP_LABELS.qr,
      ready: qrReady,
      href: qrReady ? QR_POSTER_PATH : QR_LAUNCH_TAB_PATH,
      actionLabel: qrReady ? "Open venue QR" : "Create your QR",
    },
  }
  const setupSteps = LAUNCH_CHECKLIST_STEP_ORDER.map((id) => stepById[id])
  const qrStep = stepById.qr
  const billingChecklist = billing
    ? buildBillingChecklistItem(billingReady)
    : null
  const checklist = billingChecklist
    ? [...setupSteps, qrStep, billingChecklist]
    : [...setupSteps, qrStep]
  const steps = [...setupSteps, qrStep]
  const completed = checklist.filter((step) => step.ready).length
  const total = checklist.length
  const tabs = {
    card: cardReady,
    rewards: rewardsReady,
    venue: venueReady,
    qr: qrReady,
  }

  return {
    steps,
    checklist,
    completed,
    total,
    launchReady: completed === total,
    nextStep: checklist.find((step) => !step.ready) ?? null,
    tabs,
  }
}

function buildBillingChecklistItem(
  billingReady: boolean
): LaunchReadinessAction {
  return {
    id: "billing",
    tab: "billing",
    label: LAUNCH_SETUP_STEP_LABELS.billing,
    ready: billingReady,
    href: "/app/launch?tab=billing",
    actionLabel: billingReady ? "View billing" : "Add a card to activate",
  }
}

function isVenueReady(location: LaunchLocation): boolean {
  if (!location?.address) {
    return false
  }

  return !location.require_geofence || hasVenueCoordinates(location)
}

function hasVenueCoordinates(location: NonNullable<LaunchLocation>): boolean {
  return location.latitude !== null && location.longitude !== null
}

// Statuses that count as launch-ready when billing is required. Allowlist
// (not denylist) so unknown/transitional states such as not_started, past_due,
// unpaid, or incomplete are treated as not-ready rather than ready. Mirrors the
// BillingPanel/dashboard predicate (shouldShowMerchantDashboardBillingNotice in
// components/merchant/billing-status.tsx), including its `trial` -> `trialing`
// normalization. Kept inline here so this pure lib does not import a component
// module (lib never depends on components in this codebase).
const LAUNCH_READY_BILLING_STATUSES = new Set(["active", "trialing"])

function isBillingReady(billing: LaunchBilling | undefined): boolean {
  if (!billing?.requiresBilling) {
    return true
  }

  if (billing.status === null) {
    return false
  }

  const status = billing.status === "trial" ? "trialing" : billing.status
  return LAUNCH_READY_BILLING_STATUSES.has(status)
}

function cardActionLabel(cardReady: boolean): string {
  return cardReady ? "Review card" : "Build card"
}

export function isLaunchBillingReady(billing: LaunchBilling | undefined): boolean {
  return isBillingReady(billing)
}

export function needsLaunchBillingActivation(
  readiness: LaunchReadiness
): boolean {
  return readiness.nextStep?.id === "billing"
}

export function resolveLaunchBillingHref(
  readiness: LaunchReadiness
): string | null {
  return needsLaunchBillingActivation(readiness)
    ? "/app/launch?tab=billing"
    : null
}

export function isLaunchSetupCompleteWithoutQr(
  checklist: LaunchReadinessAction[]
): boolean {
  return checklist
    .filter((step) => step.id !== "qr")
    .every((step) => step.ready)
}

// --- Join-QR provisioning eligibility -------------------------------------
//
export type EnsureJoinQrInput = {
  merchantId: string
  activeCard: { id: string } | null
  activeRewardPoolItemCount: number
  venueReady: boolean
  qrCode: { id: string; is_active: boolean } | null
}

export function isJoinQrProvisionEligible(input: EnsureJoinQrInput): boolean {
  return (
    input.activeCard !== null &&
    input.activeRewardPoolItemCount >= LAUNCH_MIN_ACTIVE_REWARDS &&
    input.venueReady &&
    input.qrCode?.is_active !== true
  )
}

// --- Launch page view derivations -----------------------------------------
//
// Pure mappings from readiness + the requested tab to the launch hub's tab
// selection and "continue" affordances. Moved out of the route component so the
// branching is testable and the page stays presentational.

export const LAUNCH_HUB_TABS = [
  { id: "venue", label: LAUNCH_SETUP_STEP_LABELS.venue },
  { id: "card", label: LAUNCH_SETUP_STEP_LABELS.card },
  { id: "rewards", label: LAUNCH_SETUP_STEP_LABELS.rewards },
  { id: "qr", label: LAUNCH_SETUP_STEP_LABELS.qr },
  { id: "billing", label: LAUNCH_SETUP_STEP_LABELS.billing },
] as const satisfies ReadonlyArray<{ id: LaunchHubTab; label: string }>

export function isLaunchHubTab(value: string | undefined): value is LaunchHubTab {
  return LAUNCH_HUB_TABS.some((tab) => tab.id === value)
}

function isLaunchReadinessTab(
  value: LaunchReadinessTab | "billing" | undefined
): value is LaunchReadinessTab {
  return (
    value === "card" ||
    value === "rewards" ||
    value === "venue" ||
    value === "qr"
  )
}

function resolveDefaultLaunchTab(readiness: LaunchReadiness): LaunchHubTab {
  if (readiness.launchReady) {
    return "qr"
  }

  const nextTab = readiness.nextStep?.tab

  if (nextTab === "billing") {
    return "billing"
  }

  return isLaunchReadinessTab(nextTab) ? nextTab : "card"
}

/**
 * The active tab is the explicitly requested one when valid, otherwise the next
 * incomplete step (or the QR tab once everything is ready).
 */
export function resolveLaunchActiveTab(
  requestedTab: string | undefined,
  readiness: LaunchReadiness
): LaunchHubTab {
  return isLaunchHubTab(requestedTab)
    ? requestedTab
    : resolveDefaultLaunchTab(readiness)
}

/**
 * Where the rewards step's "continue" button should point once the reward pool
 * is complete: billing if that is the outstanding gate, else the QR step, else
 * billing-or-QR as a fallback. Null while the pool is still short.
 */
export function resolveRewardsContinueHref(
  readiness: LaunchReadiness
): string | null {
  if (!readiness.tabs.rewards) {
    return null
  }

  if (needsLaunchBillingActivation(readiness)) {
    return resolveLaunchBillingHref(readiness)
  }

  if (!readiness.tabs.qr) {
    return QR_LAUNCH_TAB_PATH
  }

  return resolveLaunchBillingHref(readiness) ?? QR_LAUNCH_TAB_PATH
}

export function rewardsContinueLabel(continueHref: string | null): string {
  if (!continueHref) {
    return "the next step"
  }

  if (continueHref.includes("billing")) {
    return "billing"
  }

  if (continueHref.includes("tab=qr")) {
    return "your venue QR"
  }

  return "the next step"
}
