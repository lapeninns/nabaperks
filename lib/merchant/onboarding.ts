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

type MerchantOnboardingLocation = {
  name: string | null
  address: string | null
  address_line_1: string | null
  address_city: string | null
  address_postcode: string | null
  latitude: number | null
  longitude: number | null
  require_geofence: boolean | null
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

  const { data: location, error: locationError } = await supabase
    .from("merchant_locations")
    .select(
      "name, address, address_line_1, address_city, address_postcode, latitude, longitude, require_geofence"
    )
    .eq("merchant_id", merchant.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (locationError) {
    throw new Error(
      `Unable to load merchant location: ${locationError.message}`
    )
  }

  const initialFields = {
    businessName: merchantForApp.business_name,
    businessType: merchantForApp.business_type ?? undefined,
    locationName: location?.name ?? undefined,
    phone: merchantForApp.phone ?? undefined,
  }

  if (!isCompleteOnboardingLocation(location)) {
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

function isCompleteOnboardingLocation(
  location: MerchantOnboardingLocation | null
) {
  if (!location || !hasText(location.name)) return false
  if (!hasCompleteAddress(location)) return false
  if (!location.require_geofence) return true

  return location.latitude !== null && location.longitude !== null
}

function hasCompleteAddress(location: MerchantOnboardingLocation) {
  if (hasText(location.address)) return true

  return (
    hasText(location.address_line_1) &&
    hasText(location.address_city) &&
    hasText(location.address_postcode)
  )
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0
}
