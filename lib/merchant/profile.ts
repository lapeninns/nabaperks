import "server-only"

import { getCurrentUser } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type MerchantProfile = {
  merchant: {
    id: string
    owner_user_id: string
    business_name: string
    business_type: string
    email: string
    phone: string | null
  }
  location: {
    id: string
    name: string
    address: string | null
    address_line_1: string | null
    address_line_2: string | null
    address_city: string | null
    address_postcode: string | null
  } | null
}

export async function getMerchantProfile(): Promise<MerchantProfile | null> {
  const user = await getCurrentUser()

  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const { data: merchant, error } = await supabase
    .from("merchants")
    .select("id, owner_user_id, business_name, business_type, email, phone")
    .eq("owner_user_id", user.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load merchant profile: ${error.message}`)
  }

  if (!merchant) return null

  const { data: location, error: locationError } = await supabase
    .from("merchant_locations")
    .select(
      "id, name, address, address_line_1, address_line_2, address_city, address_postcode"
    )
    .eq("merchant_id", merchant.id)
    .eq("is_primary", true)
    .maybeSingle()

  if (locationError) {
    throw new Error(
      `Unable to load merchant location: ${locationError.message}`
    )
  }

  return { merchant, location: location ?? null }
}
