import "server-only"

import {
  getQrSetup,
  type ActiveCardSummary,
  type QrCodeSummary,
} from "@/lib/merchant/qr-code"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getMerchantBilling } from "@/lib/merchant/billing"
import type {
  LaunchChecklistStepId,
  LaunchHubTab,
  LaunchReadinessTab,
  LaunchSetupStepId,
} from "@/lib/merchant/launch-readiness-contract"
import {
  LAUNCH_CHECKLIST_STEP_ORDER,
  LAUNCH_SETUP_STEP_LABELS,
} from "@/lib/merchant/launch-readiness-contract"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export { LAUNCH_SETUP_STEP_LABELS }
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

type BuildLaunchReadinessInput = {
  activeCard: ActiveCardSummary | null
  activeRewardPoolItemCount: number
  qrCode: QrCodeSummary | null
  location: {
    id: string
    name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    geofence_radius_meters: number
    require_geofence: boolean
    geocoded_at: string | null
  } | null
  billing?: {
    requiresBilling: boolean
    status: string | null
  }
}

type LaunchLocation = BuildLaunchReadinessInput["location"]
type LaunchBilling = BuildLaunchReadinessInput["billing"]

export function buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount,
  qrCode,
  location,
  billing,
}: BuildLaunchReadinessInput): LaunchReadiness {
  const cardReady = activeCard !== null
  const rewardsReady = activeRewardPoolItemCount >= 3
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
      href: "/app/launch?tab=qr",
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
// normalization. Kept inline here so this server-only lib does not import a
// component module (lib never depends on components in this codebase).
const LAUNCH_READY_BILLING_STATUSES = new Set(["active", "trialing"])

function isBillingReady(billing: LaunchBilling): boolean {
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

export function isLaunchBillingReady(billing: LaunchBilling): boolean {
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
  return needsLaunchBillingActivation(readiness) ? "/app/launch?tab=billing" : null
}

export function isLaunchSetupCompleteWithoutQr(
  checklist: LaunchReadinessAction[]
): boolean {
  return checklist
    .filter((step) => step.id !== "qr")
    .every((step) => step.ready)
}

export async function getMerchantLaunchReadiness() {
  // Resolve the merchant up front (request-memoized via React cache, so the
  // getQrSetup call below reuses it) to unblock billing readiness, which only
  // needs merchant.id. Billing then runs in parallel with the multi-round-trip
  // QR setup chain instead of waiting behind it.
  const merchant = await getCurrentMerchant()
  const [setup, billing] = await Promise.all([
    getQrSetup(),
    merchant ? getLaunchBillingReadiness(merchant.id) : Promise.resolve(undefined),
  ])

  return buildLaunchReadiness({
    activeCard: setup.activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode: setup.qrCode,
    location: setup.location,
    billing,
  })
}

export async function getLaunchBillingReadiness(
  merchantId: string
): Promise<NonNullable<LaunchBilling>> {
  const [requiresBilling, billingResult] = await Promise.all([
    getMerchantRequiresBilling(merchantId),
    getMerchantBilling(merchantId),
  ])

  return {
    requiresBilling,
    status: billingResult.ok ? (billingResult.billing?.status ?? null) : null,
  }
}

async function getMerchantRequiresBilling(
  merchantId: string
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("merchants")
    .select("requires_billing")
    .eq("id", merchantId)
    .maybeSingle()

  if (error) {
    // Fail closed: gate launch rather than open it on a transient read error.
    // Log so an infra blip flipping readiness leaves a signal, instead of being
    // silently indistinguishable from a real requires_billing=true.
    console.error(
      `[launch-readiness] Unable to read requires_billing for merchant ${merchantId}; ` +
        `defaulting to requires_billing=true (gated). ${error.message}`
    )
    return true
  }

  return readRequiresBilling(data)
}

function readRequiresBilling(data: unknown): boolean {
  if (!data || typeof data !== "object" || !("requires_billing" in data)) {
    return true
  }

  return data.requires_billing !== false
}
