import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type MerchantBilling = {
  status: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

export type MerchantBillingResult =
  | { ok: true; billing: MerchantBilling | null }
  | { ok: false }

/**
 * Read the merchant's Stripe billing row via the service-role client. Returns
 * `{ ok: false }` on any failure so callers can show safe copy without leaking
 * raw Supabase errors. Lives in `lib/` so presentational panels never build a
 * Supabase client themselves.
 */
export async function getMerchantBilling(
  merchantId: string
): Promise<MerchantBillingResult> {
  try {
    const supabase = createSupabaseServiceRoleClient()
    const { data, error } = await supabase
      .from("billing_customers")
      .select(
        "status, current_period_end, stripe_customer_id, stripe_subscription_id"
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
