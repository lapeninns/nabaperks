"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCurrentUser } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const ONBOARDING_SAVE_ERROR =
  "Profile could not be saved. Check your details and try again."

export type OnboardingActionState = {
  fields?: {
    businessName?: string
    businessType?: string
    locationName?: string
    phone?: string
  }
  errors?: {
    businessName?: string
    businessType?: string
    locationName?: string
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
  const locationName = value(formData, "locationName")
  const phone = value(formData, "phone")
  const fields = { businessName, businessType, locationName, phone }
  const errors: NonNullable<OnboardingActionState["errors"]> = {}

  if (!businessName) errors.businessName = "Enter the business name."
  if (!businessType) errors.businessType = "Choose a business type."
  if (!locationName) errors.locationName = "Enter the first location name."

  if (Object.keys(errors).length) {
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
  await capturePostHogEvent({
    eventName: "merchant_signed_up",
    merchantId,
    actorType: "merchant",
    actorId: user.id,
  })

  redirect("/app")
}
