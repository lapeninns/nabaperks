import "server-only"

import { getCurrentUser } from "@/lib/auth/session"
import { cacheByScope, merchantOnboardingCacheTag } from "@/lib/cache/tags"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

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

type MerchantOnboardingRow = MerchantForApp & {
  merchant_locations: MerchantOnboardingLocation[] | null
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

  return cacheByScope(
    () => loadMerchantOnboardingStatus(user.id),
    ["merchant-onboarding", user.id],
    [merchantOnboardingCacheTag(user.id)]
  )
}

async function loadMerchantOnboardingStatus(
  userId: string
): Promise<MerchantOnboardingStatus> {
  const supabase = createSupabaseServiceRoleClient()
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select(
      "id, business_name, business_slug, business_type, email, phone, status, merchant_locations(name, address, address_line_1, address_city, address_postcode, latitude, longitude, require_geofence)"
    )
    .eq("owner_user_id", userId)
    .order("is_primary", {
      ascending: false,
      referencedTable: "merchant_locations",
    })
    .order("created_at", {
      ascending: true,
      referencedTable: "merchant_locations",
    })
    .limit(1, { referencedTable: "merchant_locations" })
    .maybeSingle()

  if (merchantError) {
    throw new Error(`Unable to load merchant profile: ${merchantError.message}`)
  }

  if (!merchant) {
    return { status: "needs_profile", initialFields: {} }
  }

  const merchantRow: MerchantOnboardingRow = merchant
  const merchantForApp: MerchantForApp = {
    id: merchantRow.id,
    business_name: merchantRow.business_name,
    business_slug: merchantRow.business_slug,
    business_type: merchantRow.business_type,
    email: merchantRow.email,
    phone: merchantRow.phone,
    status: merchantRow.status,
  }
  const location = merchantRow.merchant_locations?.[0] ?? null

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
