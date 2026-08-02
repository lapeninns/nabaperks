import "server-only"

import { isTrialSynchronisable } from "@/lib/stripe/trial-sync-core"

export type BillingTrialSyncClaim = {
  readonly fulfilmentId: string
  readonly merchantId: string
  readonly stripeSubscriptionId: string
  readonly providerStatus: string
  readonly desiredTrialEnd: string
  readonly leaseId: string
  readonly syncReason: string
}

type TrialSubscription = {
  readonly id: string
  readonly status: string
  readonly trial_end: number | null
  readonly metadata: Record<string, string>
}

type TrialSyncErrorCode =
  | "stripe_retrieve_failed"
  | "stripe_update_failed"
  | "stripe_readback_mismatch"
  | "database_confirm_failed"
  | "subscription_not_trialing"
  | "subscription_missing"
  | "ownership_mismatch"
  | "invalid_trial_end"

type TrialUpdateParams = {
  readonly trial_end: number
  readonly proration_behavior: "none"
}

export type BillingTrialSyncDependencies = {
  readonly claim: () => Promise<BillingTrialSyncClaim | null>
  readonly retrieveSubscription: (
    subscriptionId: string
  ) => Promise<TrialSubscription | null>
  readonly updateSubscription: (
    subscriptionId: string,
    params: TrialUpdateParams,
    idempotencyKey: string
  ) => Promise<TrialSubscription>
  readonly confirm: (input: {
    fulfilmentId: string
    leaseId: string
    stripeSubscriptionId: string
    confirmedTrialEnd: string
  }) => Promise<boolean>
  readonly fail: (input: {
    fulfilmentId: string
    leaseId: string
    errorCode: TrialSyncErrorCode
  }) => Promise<boolean>
}

export type BillingTrialSyncClaimResult =
  | { readonly status: "synchronised" }
  | { readonly status: "failed"; readonly errorCode: TrialSyncErrorCode }

async function recordFailure(
  claim: BillingTrialSyncClaim,
  errorCode: TrialSyncErrorCode,
  deps: BillingTrialSyncDependencies
): Promise<BillingTrialSyncClaimResult> {
  try {
    await deps.fail({
      fulfilmentId: claim.fulfilmentId,
      leaseId: claim.leaseId,
      errorCode,
    })
  } catch {
    // Lease expiry keeps an unrecorded failure recoverable without leaking it.
  }
  return { status: "failed", errorCode }
}

export async function processBillingTrialSyncClaim(
  claim: BillingTrialSyncClaim,
  deps: BillingTrialSyncDependencies
): Promise<BillingTrialSyncClaimResult> {
  const desiredTrialEndMs = new Date(claim.desiredTrialEnd).getTime()
  if (!Number.isFinite(desiredTrialEndMs)) {
    return recordFailure(claim, "invalid_trial_end", deps)
  }

  let subscription: TrialSubscription | null
  try {
    subscription = await deps.retrieveSubscription(claim.stripeSubscriptionId)
  } catch {
    return recordFailure(claim, "stripe_retrieve_failed", deps)
  }
  if (!subscription) return recordFailure(claim, "subscription_missing", deps)
  if (subscription.id !== claim.stripeSubscriptionId) {
    return recordFailure(claim, "ownership_mismatch", deps)
  }
  if (subscription.metadata.merchant_id !== claim.merchantId) {
    return recordFailure(claim, "ownership_mismatch", deps)
  }
  if (!isTrialSynchronisable(subscription.status)) {
    return recordFailure(claim, "subscription_not_trialing", deps)
  }

  const desiredTrialEnd = Math.floor(desiredTrialEndMs / 1_000)
  const trialEnd = Math.max(desiredTrialEnd, subscription.trial_end ?? 0)
  let updated = subscription
  if (subscription.trial_end !== trialEnd) {
    try {
      updated = await deps.updateSubscription(
        claim.stripeSubscriptionId,
        {
          trial_end: trialEnd,
          proration_behavior: "none",
        },
        `billing-trial-sync:${claim.fulfilmentId}:${claim.leaseId}`
      )
    } catch {
      return recordFailure(claim, "stripe_update_failed", deps)
    }
  }
  if (!isTrialSynchronisable(updated.status)) {
    return recordFailure(claim, "subscription_not_trialing", deps)
  }
  if (
    updated.id !== claim.stripeSubscriptionId ||
    updated.trial_end !== trialEnd
  ) {
    return recordFailure(claim, "stripe_readback_mismatch", deps)
  }

  const confirmedTrialEnd = new Date(trialEnd * 1_000).toISOString()
  try {
    const confirmed = await deps.confirm({
      fulfilmentId: claim.fulfilmentId,
      leaseId: claim.leaseId,
      stripeSubscriptionId: claim.stripeSubscriptionId,
      confirmedTrialEnd,
    })
    if (confirmed) return { status: "synchronised" }
  } catch {
    return recordFailure(claim, "database_confirm_failed", deps)
  }
  return recordFailure(claim, "database_confirm_failed", deps)
}

export async function runBillingTrialSyncWith(
  deps: BillingTrialSyncDependencies,
  maxClaims = 50
): Promise<{ claimed: number; synchronised: number; failed: number }> {
  const limit = Number.isSafeInteger(maxClaims)
    ? Math.min(50, Math.max(1, maxClaims))
    : 50
  let claimed = 0
  let synchronised = 0
  let failed = 0

  while (claimed < limit) {
    const claim = await deps.claim()
    if (!claim) break
    claimed += 1
    const result = await processBillingTrialSyncClaim(claim, deps)
    if (result.status === "synchronised") synchronised += 1
    else failed += 1
  }
  return { claimed, synchronised, failed }
}

function parseClaim(value: unknown): BillingTrialSyncClaim | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const row: unknown = value[0]
  if (!isRecord(row)) {
    throw new Error("Trial sync claim was malformed")
  }
  const values = [
    row.fulfilment_id,
    row.merchant_id,
    row.stripe_subscription_id,
    row.provider_status,
    row.desired_trial_end,
    row.lease_id,
    row.sync_reason,
  ]
  if (!values.every((field) => typeof field === "string")) {
    throw new Error("Trial sync claim was malformed")
  }
  const [
    fulfilmentId,
    merchantId,
    stripeSubscriptionId,
    providerStatus,
    desiredTrialEnd,
    leaseId,
    syncReason,
  ] = values
  if (
    typeof fulfilmentId !== "string" ||
    typeof merchantId !== "string" ||
    typeof stripeSubscriptionId !== "string" ||
    typeof providerStatus !== "string" ||
    typeof desiredTrialEnd !== "string" ||
    typeof leaseId !== "string" ||
    typeof syncReason !== "string"
  ) {
    throw new Error("Trial sync claim was malformed")
  }
  return {
    fulfilmentId,
    merchantId,
    stripeSubscriptionId,
    providerStatus,
    desiredTrialEnd,
    leaseId,
    syncReason,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function runBillingTrialSync() {
  const [{ createSupabaseServiceRoleClient }, { getStripe }] =
    await Promise.all([
      import("@/lib/supabase/server"),
      import("@/lib/stripe/server"),
    ])
  const supabase = createSupabaseServiceRoleClient()
  const stripe = getStripe()
  return runBillingTrialSyncWith({
    claim: async () => {
      const result = await supabase.rpc("claim_merchant_launch_trial_sync")
      if (result.error) throw new Error("Trial sync claim failed")
      return parseClaim(result.data)
    },
    retrieveSubscription: (subscriptionId) =>
      stripe.subscriptions.retrieve(subscriptionId),
    updateSubscription: (subscriptionId, params, idempotencyKey) =>
      stripe.subscriptions.update(subscriptionId, params, { idempotencyKey }),
    confirm: async (input) => {
      const result = await supabase.rpc("confirm_merchant_launch_trial_sync", {
        p_fulfilment_id: input.fulfilmentId,
        p_lease_id: input.leaseId,
        p_stripe_subscription_id: input.stripeSubscriptionId,
        p_confirmed_trial_end: input.confirmedTrialEnd,
      })
      if (result.error) throw new Error("Trial sync confirmation failed")
      return result.data === true
    },
    fail: async (input) => {
      const result = await supabase.rpc("fail_merchant_launch_trial_sync", {
        p_fulfilment_id: input.fulfilmentId,
        p_lease_id: input.leaseId,
        p_error_code: input.errorCode,
      })
      if (result.error) throw new Error("Trial sync failure record failed")
      return result.data === true
    },
  })
}
