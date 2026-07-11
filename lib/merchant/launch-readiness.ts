import "server-only"

import { cache } from "react"

import { getQrSetup } from "@/lib/merchant/qr-code"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  getMerchantBilling,
  getMerchantBillingFresh,
  type MerchantBillingResult,
} from "@/lib/merchant/billing"
import { LAUNCH_SETUP_STEP_LABELS } from "@/lib/merchant/launch-readiness-contract"
import type {
  LaunchHubTab,
  LaunchReadinessTab,
  LaunchSetupStepId,
} from "@/lib/merchant/launch-readiness-contract"
import {
  buildLaunchReadiness,
  isLaunchBillingReady,
  isLaunchSetupCompleteWithoutQr,
  isVenueOperational,
  needsLaunchBillingActivation,
  resolveLaunchBillingHref,
} from "@/lib/merchant/launch-readiness-core"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

// Re-export the pure readiness domain so existing server consumers can keep
// importing everything from `@/lib/merchant/launch-readiness`. New code may
// import the pure pieces directly from `./launch-readiness-core`.
export {
  buildLaunchReadiness,
  isLaunchBillingReady,
  isLaunchSetupCompleteWithoutQr,
  isVenueOperational,
  needsLaunchBillingActivation,
  resolveLaunchBillingHref,
}
export { LAUNCH_SETUP_STEP_LABELS }
export type { LaunchSetupStepId, LaunchReadinessTab, LaunchHubTab }
export type {
  BuildLaunchReadinessInput,
  LaunchBilling,
  LaunchReadiness,
  LaunchReadinessAction,
  LaunchReadinessStep,
} from "@/lib/merchant/launch-readiness-core"

// Request-memoized: the merchant layout (via MerchantSetupReminder) and the
// dashboard page both read readiness in one render, so cache() collapses the
// duplicate getQrSetup round-trip chain to a single fetch per request.
export const getMerchantLaunchReadiness = cache(async () => {
  // Resolve the merchant up front (request-memoized via React cache, so the
  // getQrSetup call below reuses it) to unblock billing readiness, which only
  // needs merchant.id. Billing then runs in parallel with the multi-round-trip
  // QR setup chain instead of waiting behind it.
  const merchant = await getCurrentMerchant()
  const [setup, billing] = await Promise.all([
    getQrSetup(),
    merchant
      ? getLaunchBillingReadiness(
          merchant.id,
          // Reuse requires_billing from the already-resolved (request-cached)
          // merchant row instead of re-querying merchants for one boolean.
          // `!== false` preserves the fail-closed default (gate on missing).
          merchant.requires_billing !== false
        )
      : Promise.resolve(undefined),
  ])

  return buildLaunchReadiness({
    activeCard: setup.activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode: setup.qrCode,
    location: setup.location,
    billing,
  })
})

export async function getLaunchBillingReadiness(
  merchantId: string,
  // When the caller already holds the merchant row (e.g. the dashboard, which
  // resolves it via the request-cached getCurrentMerchant), it passes
  // requires_billing here to skip the extra merchants SELECT this otherwise
  // runs. Omitted callers keep the original self-contained query.
  requiresBillingHint?: boolean
): Promise<{ requiresBilling: boolean; status: string | null }> {
  return loadLaunchBillingReadiness(
    merchantId,
    requiresBillingHint,
    getMerchantBilling
  )
}

export async function getLaunchBillingReadinessFresh(
  merchantId: string,
  requiresBillingHint?: boolean
): Promise<{ requiresBilling: boolean; status: string | null }> {
  return loadLaunchBillingReadiness(
    merchantId,
    requiresBillingHint,
    getMerchantBillingFresh
  )
}

async function loadLaunchBillingReadiness(
  merchantId: string,
  requiresBillingHint: boolean | undefined,
  loadBilling: (merchantId: string) => Promise<MerchantBillingResult>
): Promise<{ requiresBilling: boolean; status: string | null }> {
  const [requiresBilling, billingResult] = await Promise.all([
    requiresBillingHint === undefined
      ? getMerchantRequiresBilling(merchantId)
      : Promise.resolve(requiresBillingHint),
    loadBilling(merchantId),
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
