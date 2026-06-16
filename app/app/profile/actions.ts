"use server"

import { revalidatePath } from "next/cache"

import { recordProductEvent } from "@/lib/analytics/events"
import { getMerchantProfile } from "@/lib/merchant/profile"
import { resolveStructuredVenueAddress } from "@/lib/merchant/resolve-venue-address"
import {
  parseVenueAddressFields,
  validateVenueAddressFields,
  type VenueAddressFieldErrors,
  type VenueAddressFormFields,
} from "@/lib/merchant/venue-address"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const PROFILE_SAVE_ERROR =
  "Profile could not be saved. Check your details and try again."

const allowedBusinessTypes = new Set([
  "cafe",
  "dessert",
  "bubble_tea",
  "pub",
  "takeaway",
  "barber",
  "salon",
  "other",
])

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[+0-9()\s-]{7,20}$/

export type MerchantProfileState = {
  fields?: VenueAddressFormFields & {
    businessName?: string
    businessType?: string
    email?: string
    phone?: string
    venueName?: string
  }
  errors?: VenueAddressFieldErrors & {
    businessName?: string
    businessType?: string
    email?: string
    phone?: string
    venueName?: string
    form?: string
  }
  message?: string
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

export async function updateMerchantProfileAction(
  _state: MerchantProfileState,
  formData: FormData
): Promise<MerchantProfileState> {
  const businessName = value(formData, "businessName")
  const businessType = value(formData, "businessType")
  const email = value(formData, "email")
  const phone = value(formData, "phone")
  const venueName = value(formData, "venueName")
  const addressFields = parseVenueAddressFields(formData)
  const fields = {
    businessName,
    businessType,
    email,
    phone,
    venueName,
    ...addressFields,
  }

  const profile = await getMerchantProfile()

  if (!profile) {
    return { fields, errors: { form: "Complete merchant onboarding first." } }
  }

  const errors: NonNullable<MerchantProfileState["errors"]> = {
    ...validateVenueAddressFields(addressFields),
  }

  if (!businessName) errors.businessName = "Enter the business name."
  if (!allowedBusinessTypes.has(businessType)) {
    errors.businessType = "Choose a business type."
  }
  if (!emailPattern.test(email)) errors.email = "Enter a valid contact email."
  if (phone && !phonePattern.test(phone)) {
    errors.phone = "Enter a valid phone number."
  }
  if (!venueName) errors.venueName = "Enter your venue name."

  if (Object.keys(errors).length > 0) {
    return { fields, errors }
  }

  const resolved = await resolveStructuredVenueAddress(addressFields)

  if ("error" in resolved) {
    return { fields, errors: { ...errors, address: resolved.error } }
  }

  const supabase = await createSupabaseServerClient()
  const { error: merchantError } = await supabase
    .from("merchants")
    .update({
      business_name: businessName,
      business_type: businessType,
      email,
      phone: phone || null,
    })
    .eq("id", profile.merchant.id)

  if (merchantError) {
    return { fields, errors: { form: PROFILE_SAVE_ERROR } }
  }

  const { error: locationError } = await supabase
    .from("merchant_locations")
    .update({
      name: venueName,
      ...resolved.payload,
      geocoded_at: new Date().toISOString(),
    })
    .eq("merchant_id", profile.merchant.id)
    .eq("is_primary", true)

  if (locationError) {
    return { fields, errors: { form: PROFILE_SAVE_ERROR } }
  }

  const changedFields = diffChangedFields(profile, {
    businessName,
    businessType,
    email,
    phone,
    venueName,
    address: resolved.payload.address,
  })

  await recordProductEvent({
    eventName: "merchant_profile_updated",
    merchantId: profile.merchant.id,
    actorType: "merchant",
    actorId: profile.merchant.owner_user_id,
    metadata: { changed_fields: changedFields },
  })

  revalidatePath("/app/profile")
  revalidatePath("/app")

  return { fields, message: "Profile saved." }
}

function diffChangedFields(
  profile: NonNullable<Awaited<ReturnType<typeof getMerchantProfile>>>,
  next: {
    businessName: string
    businessType: string
    email: string
    phone: string
    venueName: string
    address: string
  }
) {
  const changed: string[] = []

  if (next.businessName !== profile.merchant.business_name) {
    changed.push("business_name")
  }
  if (next.businessType !== profile.merchant.business_type) {
    changed.push("business_type")
  }
  if (next.email !== profile.merchant.email) changed.push("email")
  if ((next.phone || null) !== (profile.merchant.phone ?? null)) {
    changed.push("phone")
  }
  if (next.venueName !== (profile.location?.name ?? "")) {
    changed.push("location_name")
  }
  if ((next.address || null) !== (profile.location?.address ?? null)) {
    changed.push("location_address")
  }

  return changed
}
