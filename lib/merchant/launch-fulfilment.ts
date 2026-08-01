import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export type MerchantLaunchFulfilment = {
  readonly fulfilmentStatus: "awaiting_dispatch" | "dispatched" | "delivered"
  readonly deliveryUnknown: boolean
  readonly dispatchedAt: string | null
  readonly deliveredAt: string | null
  readonly pilotStartsAt: string | null
  readonly basePilotEndsAt: string | null
  readonly approvedExtensionEnd: string | null
  readonly provisionalStripeTrialEnd: string | null
  readonly desiredStripeTrialEnd: string | null
  readonly confirmedStripeTrialEnd: string | null
  readonly syncStatus:
    | "awaiting_delivery"
    | "pending"
    | "retry"
    | "synchronised"
    | "review_required"
  readonly operationsReviewRequired: boolean
}

type FulfilmentRow = {
  fulfilment_status: MerchantLaunchFulfilment["fulfilmentStatus"]
  delivery_unknown: boolean
  dispatched_at: string | null
  delivered_at: string | null
  pilot_starts_at: string | null
  base_pilot_ends_at: string | null
  approved_extension_end: string | null
  provisional_stripe_trial_end: string | null
  desired_stripe_trial_end: string | null
  confirmed_stripe_trial_end: string | null
  sync_status: MerchantLaunchFulfilment["syncStatus"]
  operations_review_required: boolean
}

export async function getMerchantLaunchFulfilment(
  merchantId: string
): Promise<MerchantLaunchFulfilment | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("merchant_launch_fulfilments")
    .select(
      "fulfilment_status, delivery_unknown, dispatched_at, delivered_at, pilot_starts_at, base_pilot_ends_at, approved_extension_end, provisional_stripe_trial_end, desired_stripe_trial_end, confirmed_stripe_trial_end, sync_status, operations_review_required"
    )
    .eq("merchant_id", merchantId)
    .maybeSingle()

  if (error || !data) return null
  return mapFulfilment(data)
}

function mapFulfilment(row: FulfilmentRow): MerchantLaunchFulfilment {
  return {
    fulfilmentStatus: row.fulfilment_status,
    deliveryUnknown: row.delivery_unknown,
    dispatchedAt: row.dispatched_at,
    deliveredAt: row.delivered_at,
    pilotStartsAt: row.pilot_starts_at,
    basePilotEndsAt: row.base_pilot_ends_at,
    approvedExtensionEnd: row.approved_extension_end,
    provisionalStripeTrialEnd: row.provisional_stripe_trial_end,
    desiredStripeTrialEnd: row.desired_stripe_trial_end,
    confirmedStripeTrialEnd: row.confirmed_stripe_trial_end,
    syncStatus: row.sync_status,
    operationsReviewRequired: row.operations_review_required,
  }
}
