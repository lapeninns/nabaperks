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
} from "@/lib/merchant/venue-location-submission"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type LocationActionStatus =
  | "saved"
  | "invalid"
  | "location-error"
  | "card-error"
  | "reward-error"
  | "qr-error"

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

export async function addVenueLocationAction(formData: FormData) {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    redirect("/app/onboarding")
  }
  const submission = parseVenueLocationSubmission(formData, {
    venueNameField: "locationName",
  })
  const { errors, radius } = validateVenueLocationSubmission(submission, {
    validateGeofence: false,
  })

  if (Object.keys(errors).length > 0) {
    redirectToLocations("invalid")
  }
  const payloadResult = await resolveVenueLocationWritePayload(submission, {
    merchantId: merchant.id,
    radius: radius ?? 150,
    manualPin: null,
    isPrimary: false,
  })

  if ("errors" in payloadResult) {
    redirectToLocations("invalid")
  }
  const supabase = await createSupabaseServerClient()
  const write = await persistVenueLocationWrite({
    supabase,
    payload: payloadResult.payload,
  })

  if (write.error || !write.locationId) {
    redirectToLocations("location-error")
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
