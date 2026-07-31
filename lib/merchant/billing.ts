import "server-only"

import { cache } from "react"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export type MerchantBilling = {
  status: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_subscription_status: string | null
  stripe_subscription_created_at: string | null
  stripe_price_id: string | null
  billing_interval: string | null
  unit_amount: number | null
  currency: string | null
  cancel_at_period_end: boolean | null
  cancel_at: string | null
  launch_fee_status: string | null
}

export type MerchantBillingResult =
  | { ok: true; billing: MerchantBilling | null }
  | { ok: false }

/**
 * Read the merchant's Stripe billing row via the anon/RLS client. The
 * `billing_customers_select_owner_or_admin` policy scopes the read to the
 * caller's own merchant (or an internal admin), so a caller-supplied
 * `merchantId` that the session does not own is filtered to zero rows instead
 * of being trusted. Returns `{ ok: false }` on any failure so callers can show
 * safe copy without leaking raw Supabase errors. Lives in `lib/` so
 * presentational panels never build a Supabase client themselves.
 *
 * Wrapped in React `cache()` so repeat reads within a single request collapse
 * to one query (mirrors `getCurrentMerchant` in `lib/auth/session.ts`).
 */
async function loadMerchantBilling(
  merchantId: string
): Promise<MerchantBillingResult> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from("billing_customers")
      .select(
        "status, current_period_end, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_subscription_created_at, stripe_price_id, billing_interval, unit_amount, currency, cancel_at_period_end, cancel_at, launch_fee_status"
      )
      .eq("merchant_id", merchantId)
      .maybeSingle()

    if (error) {
      return { ok: false }
    }

    return { ok: true, billing: (data as MerchantBilling | null) ?? null }
  } catch {
    return { ok: false }
  }
}

export const getMerchantBilling = cache(loadMerchantBilling)

/** Bypass request memoization after checkout sync or other writes in the same request. */
export function getMerchantBillingFresh(merchantId: string) {
  return loadMerchantBilling(merchantId)
}
