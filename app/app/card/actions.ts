"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCurrentMerchant } from "@/lib/auth/session"
import { DEFAULT_STAMPS_REQUIRED } from "@/lib/merchant/customer-readback"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const CARD_SAVE_ERROR =
  "Mystery card could not be saved. Check your details and try again."
const REWARD_SAVE_ERROR =
  "Reward could not be saved. Check your details and try again."
const REWARD_UPDATE_ERROR = "Unable to update reward"

export type LoyaltyCardActionState = {
  fields?: {
    cardId?: string
    cardName?: string
    stampsRequired?: string
    rewardTerms?: string
    isActive?: boolean
  }
  errors?: {
    cardName?: string
    stampsRequired?: string
    rewardTerms?: string
    form?: string
  }
}

export type RewardPoolItemActionState = {
  fields?: {
    rewardPoolItemId?: string
    loyaltyCardId?: string
    rewardName?: string
    rewardTerms?: string
    weight?: string
    displayOrder?: string
    isActive?: boolean
  }
  errors?: {
    loyaltyCardId?: string
    rewardName?: string
    rewardTerms?: string
    weight?: string
    displayOrder?: string
    form?: string
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function parseInteger(input: string) {
  if (!/^\d+$/.test(input)) return null
  return Number.parseInt(input, 10)
}

function rewardPoolFields(formData: FormData) {
  return {
    rewardPoolItemId: value(formData, "rewardPoolItemId"),
    loyaltyCardId: value(formData, "loyaltyCardId"),
    rewardName: value(formData, "rewardName"),
    rewardTerms: value(formData, "rewardTerms"),
    weight: value(formData, "weight") || "1",
    displayOrder: value(formData, "displayOrder") || "0",
    isActive: formData.get("isActive") === "on",
  }
}

export async function saveLoyaltyCardAction(
  _state: LoyaltyCardActionState,
  formData: FormData
): Promise<LoyaltyCardActionState> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return {
      errors: { form: "Complete merchant onboarding before saving a card." },
    }
  }

  const cardId = value(formData, "cardId")
  const cardName = value(formData, "cardName")
  const stampsRequired = value(formData, "stampsRequired")
  const rewardTerms = value(formData, "rewardTerms")
  const isActive = formData.get("isActive") === "on"
  const fields = {
    cardId,
    cardName,
    stampsRequired,
    rewardTerms,
    isActive,
  }
  const errors: NonNullable<LoyaltyCardActionState["errors"]> = {}
  const parsedStampsRequired = parseInteger(stampsRequired)

  if (!cardName) errors.cardName = "Enter a card name."
  if (cardName.length > 80) errors.cardName = "Use 80 characters or fewer."

  if (parsedStampsRequired === null) {
    errors.stampsRequired = "Enter a whole number of stamps."
  } else if (parsedStampsRequired < DEFAULT_STAMPS_REQUIRED) {
    errors.stampsRequired = `Use at least ${DEFAULT_STAMPS_REQUIRED} visits.`
  } else if (parsedStampsRequired > 99) {
    errors.stampsRequired = "Use 99 stamps or fewer."
  }

  if (!rewardTerms) {
    errors.rewardTerms = "Enter clear mystery reward terms."
  } else if (rewardTerms.length < 12) {
    errors.rewardTerms =
      "Add enough detail for customers to understand the offer."
  } else if (rewardTerms.length > 500) {
    errors.rewardTerms = "Use 500 characters or fewer."
  }

  if (Object.keys(errors).length || parsedStampsRequired === null) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("save_loyalty_card", {
    p_merchant_id: merchant.id,
    p_card_id: cardId || null,
    p_card_name: cardName,
    p_stamps_required: parsedStampsRequired,
    p_reward_name: "Surprise reward",
    p_reward_terms: rewardTerms,
    p_is_active: isActive,
  })

  if (error) {
    return {
      fields,
      errors: {
        form: CARD_SAVE_ERROR,
      },
    }
  }

  await capturePostHogEvent({
    eventName: cardId ? "loyalty_card_updated" : "loyalty_card_created",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
  })

  redirect("/app/launch?tab=card&saved=1")
}

export async function saveRewardPoolItemAction(
  _state: RewardPoolItemActionState,
  formData: FormData
): Promise<RewardPoolItemActionState> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return {
      errors: { form: "Complete merchant onboarding before saving rewards." },
    }
  }

  const fields = rewardPoolFields(formData)
  const errors: NonNullable<RewardPoolItemActionState["errors"]> = {}
  const parsedWeight = parseInteger(fields.weight)
  const parsedDisplayOrder = parseInteger(fields.displayOrder)

  if (!fields.loyaltyCardId) {
    errors.loyaltyCardId = "Save the mystery card before adding rewards."
  }

  if (!fields.rewardName) errors.rewardName = "Enter the reward name."
  if (fields.rewardName.length > 100) {
    errors.rewardName = "Use 100 characters or fewer."
  }

  if (!fields.rewardTerms) {
    errors.rewardTerms = "Enter clear customer-facing reward terms."
  } else if (fields.rewardTerms.length < 12) {
    errors.rewardTerms =
      "Add enough detail for customers to understand the offer."
  } else if (fields.rewardTerms.length > 500) {
    errors.rewardTerms = "Use 500 characters or fewer."
  }

  if (parsedWeight === null) {
    errors.weight = "Enter a whole-number weight."
  } else if (parsedWeight < 1) {
    errors.weight = "Use a weight of at least 1."
  } else if (parsedWeight > 1000) {
    errors.weight = "Use a weight of 1,000 or less."
  }

  if (parsedDisplayOrder === null) {
    errors.displayOrder = "Enter a whole-number display order."
  }

  if (
    Object.keys(errors).length ||
    parsedWeight === null ||
    parsedDisplayOrder === null
  ) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("upsert_reward_pool_item", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: fields.loyaltyCardId,
    p_reward_pool_item_id: fields.rewardPoolItemId || null,
    p_reward_name: fields.rewardName,
    p_reward_terms: fields.rewardTerms,
    p_weight: parsedWeight,
    p_is_active: fields.isActive,
    p_display_order: parsedDisplayOrder,
  })

  if (error) {
    return {
      fields,
      errors: {
        form: REWARD_SAVE_ERROR,
      },
    }
  }

  await capturePostHogEvent({
    eventName: data?.[0]?.saved_action ?? "reward_pool_item_saved",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: { loyalty_card_id: fields.loyaltyCardId },
  })

  redirect("/app/launch?tab=rewards&saved=pool")
}

export async function deleteRewardPoolItemAction(formData: FormData) {
  const merchant = await getCurrentMerchant()
  const rewardPoolItemId = value(formData, "rewardPoolItemId")

  if (!merchant || !rewardPoolItemId) {
    redirect(
      `/app/launch?tab=rewards&error=${encodeURIComponent(REWARD_UPDATE_ERROR)}`
    )
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("delete_reward_pool_item", {
    p_merchant_id: merchant.id,
    p_reward_pool_item_id: rewardPoolItemId,
  })

  if (error) {
    redirect(
      `/app/launch?tab=rewards&error=${encodeURIComponent(REWARD_UPDATE_ERROR)}`
    )
  }

  await capturePostHogEvent({
    eventName: data?.[0]?.deleted
      ? "reward_pool_item_deleted"
      : "reward_pool_item_archived",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: { reward_pool_item_id: rewardPoolItemId },
  })

  redirect("/app/launch?tab=rewards&saved=pool")
}
