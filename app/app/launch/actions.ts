"use server"

import { revalidatePath } from "next/cache"

import { getCurrentMerchant } from "@/lib/auth/session"
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
    venueName?: string
    geofenceRadiusMeters?: string
    requireGeofence?: boolean
    venueLatitude?: string
    venueLongitude?: string
    geofencePinSource?: string
  }
  errors?: VenueAddressFieldErrors & {
    venueName?: string
    geofenceRadiusMeters?: string
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

  const submission = parseVenueLocationSubmission(formData)
  const fields = submissionToFields(submission)
  const { errors, radius, manualPin } = validateVenueLocationSubmission(submission)

  if (Object.keys(errors).length > 0 || radius === null) {
    return { fields, errors }
  }

  const resolved = await resolveVenueLocationWritePayload(submission, {
    merchantId: merchant.id,
    radius,
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

  revalidatePath("/app/launch")
  revalidatePath("/app")

  return { fields, saved: true }
}

function submissionToFields(
  submission: ReturnType<typeof parseVenueLocationSubmission>
): NonNullable<VenueLocationActionState["fields"]> {
  return {
    venueName: submission.venueName,
    ...submission.addressFields,
    geofenceRadiusMeters: submission.geofenceRadiusMeters,
    requireGeofence: submission.requireGeofence,
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
