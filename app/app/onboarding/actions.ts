"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCurrentUser } from "@/lib/auth/session"
import {
  revalidateMerchantCacheTags,
  revalidateMerchantOnboardingCache,
} from "@/lib/cache/tags"
import {
  parseVenueLocationSubmission,
  resolveVenueLocationPersistencePayload,
  validateVenueLocationSubmission,
} from "@/lib/merchant/venue-location-submission"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const ONBOARDING_SAVE_ERROR =
  "Profile could not be saved. Check your details and try again."
const ONBOARDING_BUSINESS_TYPES = new Set([
  "cafe",
  "dessert",
  "bubble_tea",
  "pub",
  "takeaway",
  "barber",
  "salon",
  "other",
])

export type OnboardingActionState = {
  fields?: {
    businessName?: string
    businessType?: string
    locationName?: string
    phone?: string
    addressLine1?: string
    addressLine2?: string
    addressCity?: string
    addressPostcode?: string
  }
  errors?: {
    businessName?: string
    businessType?: string
    locationName?: string
    addressLine1?: string
    addressLine2?: string
    addressCity?: string
    addressPostcode?: string
    address?: string
    form?: string
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

export async function completeOnboardingAction(
  _state: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const user = await getCurrentUser()

  if (!user) {
    return { errors: { form: "Your session expired. Log in again." } }
  }

  const businessName = value(formData, "businessName")
  const businessType = value(formData, "businessType")
  const phone = value(formData, "phone")
  const venueSubmission = parseVenueLocationSubmission(formData, {
    venueNameField: "locationName",
    defaultVenueName: businessName,
  })
  const locationName = venueSubmission.venueName
  const fields = {
    businessName,
    businessType,
    locationName,
    phone,
    ...venueSubmission.addressFields,
  }
  const errors: NonNullable<OnboardingActionState["errors"]> = {}

  if (!businessName) {
    errors.businessName = "Enter the business name."
  } else if (businessName.length > 120) {
    errors.businessName = "Use 120 characters or fewer."
  }
  if (!businessType) {
    errors.businessType = "Choose a business type."
  } else if (!ONBOARDING_BUSINESS_TYPES.has(businessType)) {
    errors.businessType = "Choose a listed business type."
  }

  const venueValidation = validateVenueLocationSubmission(venueSubmission, {
    validateGeofence: false,
  })
  const venueErrors = mapVenueErrors(venueValidation.errors)

  Object.assign(errors, venueErrors)

  if (
    Object.keys(errors).length ||
    venueValidation.radius === null ||
    venueValidation.softGeofenceTriggerStamp === null
  ) {
    return { fields, errors }
  }

  const resolved = await resolveVenueLocationPersistencePayload(
    venueSubmission,
    {
      radius: venueValidation.radius,
      manualPin: venueValidation.manualPin,
      softGeofenceTriggerStamp: venueValidation.softGeofenceTriggerStamp,
    }
  )

  if ("errors" in resolved) {
    return {
      fields,
      errors: {
        ...mapVenueErrors(resolved.errors),
        form: ONBOARDING_SAVE_ERROR,
      },
    }
  }

  const venue = resolved.payload
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("complete_merchant_onboarding", {
    p_business_name: businessName,
    p_business_type: businessType,
    p_phone: phone,
    p_location_name: venue.name,
    p_address_line_1: venue.address_line_1,
    p_address_line_2: venue.address_line_2,
    p_address_city: venue.address_city,
    p_address_postcode: venue.address_postcode,
    p_address_provider: venue.address_provider,
    p_address_provider_id: venue.address_provider_id,
    p_address_source: venue.address_source,
    p_latitude: venue.latitude,
    p_longitude: venue.longitude,
    p_geofence_radius_meters: venue.geofence_radius_meters,
    p_require_geofence: venue.require_geofence,
    p_soft_geofence_trigger_stamp_number:
      venue.soft_geofence_trigger_stamp_number,
    p_geofence_pin_source: venue.geofence_pin_source,
  })

  if (error) {
    return {
      fields,
      errors: {
        form: ONBOARDING_SAVE_ERROR,
      },
    }
  }

  const result = data?.[0] as
    | {
        merchant_id?: string
        location_id?: string
        completed_now?: boolean
      }
    | undefined
  const merchantId = result?.merchant_id
  const locationId = result?.location_id

  if (!merchantId || !locationId) {
    return {
      fields,
      errors: {
        form: ONBOARDING_SAVE_ERROR,
      },
    }
  }

  if (result.completed_now) {
    await capturePostHogEvent({
      eventName: "merchant_signed_up",
      merchantId,
      actorType: "merchant",
      actorId: user.id,
    })
  }

  revalidateMerchantOnboardingCache(user.id)
  revalidateMerchantCacheTags(merchantId)

  redirect("/app/launch?tab=card")
}

function mapVenueErrors(
  errors: ReturnType<typeof validateVenueLocationSubmission>["errors"]
): NonNullable<OnboardingActionState["errors"]> {
  const mapped: NonNullable<OnboardingActionState["errors"]> = {}

  if (errors.addressLine1) mapped.addressLine1 = errors.addressLine1
  if (errors.addressLine2) mapped.addressLine2 = errors.addressLine2
  if (errors.addressCity) mapped.addressCity = errors.addressCity
  if (errors.addressPostcode) mapped.addressPostcode = errors.addressPostcode
  if (errors.address) mapped.address = errors.address
  if (errors.form) mapped.form = errors.form
  if (errors.venueName) mapped.locationName = errors.venueName

  return mapped
}
