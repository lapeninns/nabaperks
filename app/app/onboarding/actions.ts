"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCurrentUser } from "@/lib/auth/session"
import {
  parseVenueLocationSubmission,
  persistVenueLocationWrite,
  resolveVenueLocationWritePayload,
  validateVenueLocationSubmission,
} from "@/lib/merchant/venue-location-submission"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const ONBOARDING_SAVE_ERROR =
  "Profile could not be saved. Check your details and try again."

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

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
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

  if (!businessName) errors.businessName = "Enter the business name."
  if (!businessType) errors.businessType = "Choose a business type."

  const venueValidation = validateVenueLocationSubmission(venueSubmission, {
    validateGeofence: false,
  })
  const venueErrors = mapVenueErrors(venueValidation.errors)

  Object.assign(errors, venueErrors)

  if (Object.keys(errors).length || venueValidation.radius === null) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const baseSlug = slugify(businessName) || "merchant"
  const businessSlug = `${baseSlug}-${user.id.slice(0, 8)}`
  const { data, error } = await supabase.rpc("create_merchant_onboarding", {
    p_owner_user_id: user.id,
    p_email: user.email ?? "",
    p_business_name: businessName,
    p_business_slug: businessSlug,
    p_business_type: businessType,
    p_phone: phone,
    p_location_name: locationName,
  })

  if (error) {
    return {
      fields,
      errors: {
        form: ONBOARDING_SAVE_ERROR,
      },
    }
  }

  const merchantId = data?.[0]?.merchant_id
  const locationId = data?.[0]?.location_id

  if (!merchantId || !locationId) {
    return {
      fields,
      errors: {
        form: ONBOARDING_SAVE_ERROR,
      },
    }
  }

  const resolved = await resolveVenueLocationWritePayload(venueSubmission, {
    merchantId,
    radius: venueValidation.radius,
    manualPin: venueValidation.manualPin,
  })

  if ("errors" in resolved) {
    return {
      fields,
      errors: {
        ...mapVenueErrors(resolved.errors),
        form: ONBOARDING_SAVE_ERROR,
      },
    }
  }

  const writeResult = await persistVenueLocationWrite({
    supabase,
    locationId,
    payload: resolved.payload,
  })

  if (writeResult.error) {
    return {
      fields,
      errors: {
        form: ONBOARDING_SAVE_ERROR,
      },
    }
  }

  await capturePostHogEvent({
    eventName: "merchant_signed_up",
    merchantId,
    actorType: "merchant",
    actorId: user.id,
  })

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
