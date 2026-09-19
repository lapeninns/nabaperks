"use server"

import { redirect } from "next/navigation"

import { getCurrentMerchant } from "@/lib/auth/session"
import {
  collectionWindowError,
  parseCollectionWindows,
  parseVenueClosure,
  type VenueClosureErrors,
  type VenueClosureFields,
} from "@/lib/merchant/collection-window-fields"
import { revalidateMerchantLaunchSurfaces } from "@/lib/merchant/revalidate-launch-surfaces"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type CollectionWindowActionState = { readonly error?: string }
export type VenueClosureActionState = {
  readonly fields?: VenueClosureFields
  readonly errors?: VenueClosureErrors
}

function value(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

export async function saveCollectionWindowsAction(
  _state: CollectionWindowActionState,
  formData: FormData
): Promise<CollectionWindowActionState> {
  const merchant = await getCurrentMerchant()
  if (!merchant)
    return {
      error: "Complete merchant onboarding before saving collection windows.",
    }
  let submitted: unknown
  try {
    submitted = JSON.parse(value(formData, "windows"))
  } catch (error) {
    if (error instanceof SyntaxError)
      return { error: collectionWindowError("NBW02") }
    throw error
  }
  const locationId = value(formData, "locationId")
  const parsed = parseCollectionWindows(submitted, locationId)
  if (!parsed.windows) return { error: collectionWindowError(parsed.code) }

  const supabase = await createSupabaseServerClient()
  const { data: location, error: locationError } = await supabase
    .from("merchant_locations")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("id", locationId)
    .maybeSingle()
  if (locationError || !location)
    return { error: collectionWindowError("NBW04") }
  const { error } = await supabase.rpc("save_venue_collection_windows", {
    p_merchant_id: merchant.id,
    p_location_id: locationId,
    p_windows: parsed.windows,
  })
  if (error) return { error: collectionWindowError(error.code) }
  revalidateMerchantLaunchSurfaces(merchant.id)
  redirect("/app/launch?tab=rewards&saved=windows")
}

export async function addVenueClosureAction(
  _state: VenueClosureActionState,
  formData: FormData
): Promise<VenueClosureActionState> {
  const fields = {
    locationId: value(formData, "locationId"),
    startsAt: value(formData, "startsAt"),
    endsAt: value(formData, "endsAt"),
    reason: value(formData, "reason"),
  }
  const merchant = await getCurrentMerchant()
  if (!merchant)
    return {
      fields,
      errors: { form: "Complete merchant onboarding before adding a closure." },
    }
  const parsed = parseVenueClosure(fields)
  if (!parsed.closure) return { fields, errors: parsed.errors }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("add_venue_closure", {
    p_merchant_id: merchant.id,
    p_location_id: parsed.closure.locationId,
    p_starts_at: parsed.closure.startsAt,
    p_ends_at: parsed.closure.endsAt,
    p_reason: parsed.closure.reason,
  })
  if (error)
    return { fields, errors: { form: collectionWindowError(error.code) } }
  revalidateMerchantLaunchSurfaces(merchant.id)
  redirect("/app/launch?tab=rewards&saved=closure")
}

export async function endVenueClosureAction(
  _state: CollectionWindowActionState,
  formData: FormData
): Promise<CollectionWindowActionState> {
  const merchant = await getCurrentMerchant()
  if (!merchant)
    return { error: "Sign in as the venue owner to end a closure." }
  const closureId = value(formData, "closureId")
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(closureId)) {
    return { error: collectionWindowError("NBW07") }
  }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("end_venue_closure", {
    p_closure_id: closureId,
  })
  if (error) return { error: collectionWindowError(error.code) }
  revalidateMerchantLaunchSurfaces(merchant.id)
  redirect("/app/launch?tab=rewards&saved=closure-ended")
}
