import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function customerHasVerifiedPhone(
  customerId: string
): Promise<boolean> {
  const { data, error } = await createSupabaseServiceRoleClient()
    .from("customers")
    .select("phone_hmac, phone_verified_at")
    .eq("id", customerId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.phone_hmac && data.phone_verified_at)
}
