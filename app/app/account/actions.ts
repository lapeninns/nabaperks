"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentMerchant } from "@/lib/auth/session"
import { revalidateMerchantCacheTags } from "@/lib/cache/tags"
import {
  parseVenueLocationSubmission,
  persistVenueLocationWrite,
  resolveVenueLocationWritePayload,
  validateVenueLocationSubmission,
  type VenueLocationSubmission,
  type VenueLocationSubmissionErrors,
} from "@/lib/merchant/venue-location-submission"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type LocationActionStatus =
  | "saved"
  | "invalid"
  | "location-error"
  | "card-error"
  | "reward-error"
  | "qr-error"

/**
 * useActionState shape for the add-location form: typed values survive a
 * failed validation round-trip (field persistence) and errors are per-field
 * (`venueName` maps to the locationName input). Post-save partial failures
 * (card/reward/qr) still redirect with a `?locations=` status because the
 * location row exists by then and the list itself must refresh.
 */
export type AddLocationFormState = {
  fields?: {
    locationName?: string
    addressLine1?: string
    addressLine2?: string
    addressCity?: string
    addressPostcode?: string
  }
  errors?: VenueLocationSubmissionErrors
}

type PrimaryCardTemplate = {
  readonly id: string
  readonly card_name: string
  readonly stamps_required: number
  readonly reward_name: string
  readonly reward_terms: string
}

type RewardPoolTemplate = {
  readonly reward_name: string
  readonly reward_terms: string
  readonly weight: number
  readonly is_active: boolean
  readonly display_order: number
}

export async function addVenueLocationAction(
  _state: AddLocationFormState,
  formData: FormData
): Promise<AddLocationFormState> {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    redirect("/app/onboarding")
  }
  const submission = parseVenueLocationSubmission(formData, {
    venueNameField: "locationName",
  })
  const fields = submissionToFields(submission)
  const { errors, radius } = validateVenueLocationSubmission(submission, {
    validateGeofence: false,
  })

  if (Object.keys(errors).length > 0) {
    // Field persistence: typed values and per-field errors go back to the
    // form instead of a redirect that wiped everything.
    return { fields, errors }
  }
  const payloadResult = await resolveVenueLocationWritePayload(submission, {
    merchantId: merchant.id,
    radius: radius ?? 150,
    manualPin: null,
    isPrimary: false,
  })

  if ("errors" in payloadResult) {
    return { fields, errors: payloadResult.errors }
  }
  const supabase = await createSupabaseServerClient()
  const write = await persistVenueLocationWrite({
    supabase,
    payload: payloadResult.payload,
  })

  if (write.error || !write.locationId) {
    return {
      fields,
      errors: { form: "The location could not be saved. Try again." },
    }
  }
  const card = await clonePrimaryActiveCard({
    supabase,
    merchantId: merchant.id,
    locationId: write.locationId,
  })

  if (!card.cardId || !card.sourceCardId) {
    redirectToLocations("card-error")
  }
  const clonedRewards = await cloneActiveRewardPool({
    supabase,
    merchantId: merchant.id,
    sourceCardId: card.sourceCardId,
    targetCardId: card.cardId,
  })

  if (!clonedRewards) {
    redirectToLocations("reward-error")
  }

  const { error: qrError } = await supabase.rpc("create_or_get_join_qr", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: card.cardId,
  })

  if (qrError) {
    redirectToLocations("qr-error")
  }

  revalidateMerchantCacheTags(merchant.id)
  revalidatePath("/app")
  revalidatePath("/app/account")
  revalidatePath("/app/qr")
  redirectToLocations("saved")
}

/**
 * Per-location retry for the half-created state MER-P2-13 describes: the
 * location row saved but its join QR never appeared (reward/card/qr failure).
 * Re-running the add form would create a second location; this action repairs
 * the existing one instead — ensure a card, top up rewards only from an empty
 * pool (re-cloning into a part-filled pool would duplicate rewards), then ask
 * for the join QR (create_or_get_join_qr is get-or-create by name).
 */
export async function createLocationJoinQrAction(formData: FormData) {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    redirect("/app/onboarding")
  }
  const locationId = String(formData.get("locationId") ?? "")
  if (!locationId) {
    redirectToLocations("location-error")
  }

  const supabase = await createSupabaseServerClient()
  const { data: location } = await supabase
    .from("merchant_locations")
    .select("id")
    .eq("id", locationId)
    .eq("merchant_id", merchant.id)
    .maybeSingle()

  if (!location?.id) {
    redirectToLocations("location-error")
  }

  const { data: existingCard } = await supabase
    .from("loyalty_cards")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  let cardId = existingCard?.id ?? null
  if (!cardId) {
    const card = await clonePrimaryActiveCard({
      supabase,
      merchantId: merchant.id,
      locationId,
    })
    if (!card.cardId) {
      redirectToLocations("card-error")
    }
    cardId = card.cardId
  }

  const { count } = await supabase
    .from("reward_pool_items")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchant.id)
    .eq("loyalty_card_id", cardId)
    .eq("is_active", true)
  const activeRewards = count ?? 0

  if (activeRewards === 0) {
    const sourceCard = await loadPrimaryActiveCard(supabase, merchant.id)
    if (!sourceCard) {
      redirectToLocations("card-error")
    }
    const cloned = await cloneActiveRewardPool({
      supabase,
      merchantId: merchant.id,
      sourceCardId: sourceCard.id,
      targetCardId: cardId,
    })
    if (!cloned) {
      redirectToLocations("reward-error")
    }
  } else if (activeRewards < 3) {
    // A part-filled pool cannot be topped up without duplicating rewards;
    // surface the same banner so the merchant tops up the primary pool first.
    redirectToLocations("reward-error")
  }

  const { error: qrError } = await supabase.rpc("create_or_get_join_qr", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: cardId,
  })

  if (qrError) {
    redirectToLocations("qr-error")
  }

  revalidateMerchantCacheTags(merchant.id)
  revalidatePath("/app")
  revalidatePath("/app/account")
  revalidatePath("/app/qr")
  redirectToLocations("saved")
}

function submissionToFields(
  submission: VenueLocationSubmission
): NonNullable<AddLocationFormState["fields"]> {
  return {
    locationName: submission.venueName,
    addressLine1: submission.addressFields.addressLine1,
    addressLine2: submission.addressFields.addressLine2,
    addressCity: submission.addressFields.addressCity,
    addressPostcode: submission.addressFields.addressPostcode,
  }
}

async function clonePrimaryActiveCard({
  supabase,
  merchantId,
  locationId,
}: {
  readonly supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  readonly merchantId: string
  readonly locationId: string
}) {
  const sourceCard = await loadPrimaryActiveCard(supabase, merchantId)

  if (!sourceCard) {
    return { cardId: null, sourceCardId: null }
  }

  const { data, error } = await supabase.from("loyalty_cards").insert({
    merchant_id: merchantId,
    location_id: locationId,
    card_name: sourceCard.card_name,
    stamps_required: sourceCard.stamps_required,
    reward_name: sourceCard.reward_name,
    reward_terms: sourceCard.reward_terms,
    is_active: true,
  }).select("id").single()

  if (error) {
    return { cardId: null, sourceCardId: null }
  }

  return { cardId: data?.id ?? null, sourceCardId: sourceCard.id }
}

async function loadPrimaryActiveCard(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  merchantId: string
): Promise<PrimaryCardTemplate | null> {
  const { data: primaryLocation, error: locationError } = await supabase
    .from("merchant_locations")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("is_primary", true)
    .maybeSingle()

  if (locationError || !primaryLocation?.id) {
    return null
  }

  const { data, error } = await supabase
    .from("loyalty_cards")
    .select("id, card_name, stamps_required, reward_name, reward_terms")
    .eq("merchant_id", merchantId)
    .eq("location_id", primaryLocation.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    card_name: data.card_name,
    stamps_required: data.stamps_required,
    reward_name: data.reward_name,
    reward_terms: data.reward_terms,
  }
}

async function cloneActiveRewardPool({
  supabase,
  merchantId,
  sourceCardId,
  targetCardId,
}: {
  readonly supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  readonly merchantId: string
  readonly sourceCardId: string
  readonly targetCardId: string
}) {
  const { data, error } = await supabase
    .from("reward_pool_items")
    .select("reward_name, reward_terms, weight, is_active, display_order")
    .eq("merchant_id", merchantId)
    .eq("loyalty_card_id", sourceCardId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error || !data || data.length < 3) {
    return false
  }

  for (const item of normalizeRewardPoolTemplates(data)) {
    const { error: rewardError } = await supabase.rpc("upsert_reward_pool_item", {
      p_merchant_id: merchantId,
      p_loyalty_card_id: targetCardId,
      p_reward_pool_item_id: null,
      p_reward_name: item.reward_name,
      p_reward_terms: item.reward_terms,
      p_weight: item.weight,
      p_is_active: item.is_active,
      p_display_order: item.display_order,
    })

    if (rewardError) {
      return false
    }
  }

  return true
}

function normalizeRewardPoolTemplates(
  rows: readonly Partial<RewardPoolTemplate>[]
): RewardPoolTemplate[] {
  return rows
    .map((row, index) => ({
      reward_name: row.reward_name ?? "",
      reward_terms: row.reward_terms ?? "",
      weight: row.weight ?? 1,
      is_active: row.is_active ?? true,
      display_order: row.display_order ?? index,
    }))
    .filter(
      (row) =>
        row.reward_name.length > 0 &&
        row.reward_terms.length >= 12 &&
        row.is_active
    )
}

function redirectToLocations(status: LocationActionStatus): never {
  redirect(`/app/account?tab=locations&locations=${status}`)
}
