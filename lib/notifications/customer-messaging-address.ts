import "server-only"

import { decryptCustomerPhone } from "@/lib/customer/phone-pii-core"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type CustomerPhoneRecipient = {
  readonly e164: string
  readonly last4: string
}

export async function resolveCustomerPhoneRecipient(
  customerId: string
): Promise<CustomerPhoneRecipient | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers")
    .select("phone_ciphertext, phone_last4, phone_verified_at")
    .eq("id", customerId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `Unable to resolve customer phone recipient: ${error.message}`
    )
  }
  if (!data?.phone_verified_at || !data.phone_ciphertext || !data.phone_last4) {
    return null
  }

  return {
    e164: decryptCustomerPhone(data.phone_ciphertext),
    last4: data.phone_last4,
  }
}
