import "server-only"

import { getCurrentUser } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type MerchantOnboardingFields = {
  businessName?: string
  businessType?: string
  locationName?: string
  phone?: string
}

export type MerchantForApp = {
  id: string
  business_name: string
  business_slug: string
  business_type: string | null
  email: string
  status: string
  phone?: string | null
}

export type MerchantOnboardingStatus =
  | { status: "needs_profile"; initialFields: MerchantOnboardingFields }
  | {
      status: "missing_location"
      merchant: MerchantForApp
      initialFields: MerchantOnboardingFields
    }
  | {
      status: "complete"
      merchant: MerchantForApp
      initialFields: MerchantOnboardingFields
    }

export async function getMerchantOnboardingStatus(): Promise<MerchantOnboardingStatus> {
  const user = await getCurrentUser()

  if (!user) {
    return { status: "needs_profile", initialFields: {} }
  }

  const supabase = await createSupabaseServerClient()
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select(
      "id, business_name, business_slug, business_type, email, phone, status"
    )
    .eq("owner_user_id", user.id)
    .maybeSingle()

  if (merchantError) {
    throw new Error(`Unable to load merchant profile: ${merchantError.message}`)
  }

  if (!merchant) {
    return { status: "needs_profile", initialFields: {} }
  }

  const merchantForApp: MerchantForApp = {
    ...merchant,
  }

  const initialFields = {
    businessName: merchantForApp.business_name,
    businessType: merchantForApp.business_type ?? undefined,
    phone: merchantForApp.phone ?? undefined,
  }

  const { count: locationCount, error: locationError } = await supabase
    .from("merchant_locations")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchant.id)

  if (locationError) {
    throw new Error(
      `Unable to load merchant location: ${locationError.message}`
    )
  }

  if ((locationCount ?? 0) < 1) {
    return {
      status: "missing_location",
      merchant: merchantForApp,
      initialFields,
    }
  }

  return {
    status: "complete",
    merchant: merchantForApp,
    initialFields,
  }
}
