"use server"

import { getCurrentMerchant, getCurrentUser } from "@/lib/auth/session"
import {
  revalidateMerchantOnboardingCache,
} from "@/lib/cache/tags"
import { revalidateMerchantLaunchSurfaces } from "@/lib/merchant/revalidate-launch-surfaces"
import {
  parseVenueLocationSubmission,
  persistVenueLocationWrite,
  resolveVenueLocationWritePayload,
  validateVenueLocationSubmission,
  type VenueLocationSubmissionErrors,
} from "@/lib/merchant/venue-location-submission"
import type {
  VenueAddressFieldErrors,
  VenueAddressFormFields,
} from "@/lib/merchant/venue-address"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type VenueLocationActionState = {
  fields?: VenueAddressFormFields & {
    geofenceRadiusMeters?: string
    requireGeofence?: boolean
    softGeofenceTriggerStamp?: string
    venueLatitude?: string
    venueLongitude?: string
    geofencePinSource?: string
  }
  errors?: VenueAddressFieldErrors & {
    geofenceRadiusMeters?: string
    softGeofenceTriggerStamp?: string
    form?: string
  }
  saved?: boolean
}

export async function saveVenueLocationAction(
  _state: VenueLocationActionState,
  formData: FormData
): Promise<VenueLocationActionState> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return { errors: { form: "Complete merchant onboarding first." } }
  }

  const submission = parseVenueLocationSubmission(formData, {
    canonicalVenueName: merchant.business_name,
  })
  const fields = submissionToFields(submission)
  const { errors, radius, softGeofenceTriggerStamp, manualPin } =
    validateVenueLocationSubmission(submission)

  if (
    Object.keys(errors).length > 0 ||
    radius === null ||
    softGeofenceTriggerStamp === null
  ) {
    return { fields, errors }
  }

  const resolved = await resolveVenueLocationWritePayload(submission, {
    merchantId: merchant.id,
    radius,
    softGeofenceTriggerStamp,
    manualPin,
  })

  if ("errors" in resolved) {
    return { fields, errors: mergeErrors(errors, resolved.errors) }
  }

  const supabase = await createSupabaseServerClient()
  const { data: existingLocation, error: loadError } = await supabase
    .from("merchant_locations")
    .select("id")
    .eq("merchant_id", merchant.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (loadError) {
    return { fields, errors: { form: "Unable to load venue location." } }
  }

  const writeResult = await persistVenueLocationWrite({
    supabase,
    locationId: existingLocation?.id,
    payload: resolved.payload,
  })

  if (writeResult.error) {
    return { fields, errors: { form: "Unable to save venue location." } }
  }

  const user = await getCurrentUser()
  if (user) revalidateMerchantOnboardingCache(user.id)
  revalidateMerchantLaunchSurfaces(merchant.id)

  return { fields, saved: true }
}

function submissionToFields(
  submission: ReturnType<typeof parseVenueLocationSubmission>
): NonNullable<VenueLocationActionState["fields"]> {
  return {
    ...submission.addressFields,
    geofenceRadiusMeters: submission.geofenceRadiusMeters,
    requireGeofence: submission.requireGeofence,
    softGeofenceTriggerStamp: submission.softGeofenceTriggerStamp,
    venueLatitude: submission.venueLatitude,
    venueLongitude: submission.venueLongitude,
    geofencePinSource: submission.geofencePinSource,
  }
}

function mergeErrors(
  left: VenueLocationSubmissionErrors,
  right: VenueLocationSubmissionErrors
) {
  return { ...left, ...right }
}
