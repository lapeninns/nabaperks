"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCurrentMerchant } from "@/lib/auth/session"
import { revalidateMerchantLaunchSurfaces } from "@/lib/merchant/revalidate-launch-surfaces"
import {
  DEFAULT_STAMPS_REQUIRED,
  MAX_STAMPS_REQUIRED,
} from "@/lib/merchant/customer-readback"
import { autoProvisionJoinQrFromSetup } from "@/lib/merchant/ensure-join-qr"
import {
  REWARD_EXPIRY_ERROR,
  parseRewardExpiryDays,
} from "@/lib/merchant/reward-expiry-fields"
import {
  isDefiniteRewardPresetRollbackCode,
  MAX_REWARD_PRESET_BATCH,
  resolveRewardPresetsByIds,
} from "@/lib/merchant/reward-presets"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const CARD_SAVE_ERROR =
  "Mystery card could not be saved. Check your details and try again."
const REWARD_SAVE_ERROR =
  "Reward could not be saved. Check your details and try again."
const REWARD_UPDATE_ERROR = "Unable to update reward"
const REWARD_MIN_ACTIVE_ERROR =
  "Keep at least 3 active rewards before launch QR stays live."
const REWARD_PRESET_ROLLBACK_ERROR =
  "Rewards not added. Nothing was changed. Your choices are still selected — try again."
const REWARD_PRESET_CONFIRMATION_ERROR =
  "We couldn't confirm whether those rewards were added. Your choices are still selected — try again. Already-added rewards won't duplicate."

export type LoyaltyCardActionState = {
  fields?: {
    cardId?: string
    cardName?: string
    stampsRequired?: string
    rewardTerms?: string
    rewardExpiryDays?: string
    isActive?: boolean
  }
  errors?: {
    cardName?: string
    stampsRequired?: string
    rewardTerms?: string
    rewardExpiryDays?: string
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
  saved?: boolean
  qrStatus?: "created" | "enabled"
}

export type RewardPresetBatchItem = {
  id: string
  rewardName: string
  rewardTerms: string
  weight: string
  displayOrder: string
  isActive: boolean
  presetId: string
  savedAction: "reward_pool_item_created" | "reward_pool_item_existing"
}

export type RewardPresetBatchActionState = {
  fields?: {
    loyaltyCardId?: string
    presetIds?: string[]
  }
  errors?: {
    form?: string
  }
  items?: RewardPresetBatchItem[]
  saved?: boolean
  addedCount?: number
  existingCount?: number
  activeRewardCount?: number
  message?: string
  qrStatus?: "created" | "enabled"
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function parseInteger(input: string) {
  if (!/^\d+$/.test(input)) return null
  return Number.parseInt(input, 10)
}

function rewardPoolMutationError(
  error: { message?: string } | null,
  fallback = REWARD_UPDATE_ERROR
) {
  return error?.message?.includes("at least 3 active rewards")
    ? REWARD_MIN_ACTIVE_ERROR
    : fallback
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
  const rewardExpiryDays = value(formData, "rewardExpiryDays")
  const isActive = formData.get("isActive") === "on"
  const fields = {
    cardId,
    cardName,
    stampsRequired,
    rewardTerms,
    rewardExpiryDays,
    isActive,
  }
  const errors: NonNullable<LoyaltyCardActionState["errors"]> = {}
  const parsedStampsRequired = parseInteger(stampsRequired)
  const parsedRewardExpiryDays = parseRewardExpiryDays(rewardExpiryDays)

  if (parsedRewardExpiryDays === null) {
    errors.rewardExpiryDays = REWARD_EXPIRY_ERROR
  }

  if (!cardName) errors.cardName = "Enter a card name."
  if (cardName.length > 80) errors.cardName = "Use 80 characters or fewer."

  if (parsedStampsRequired === null) {
    errors.stampsRequired = "Enter a whole number of stamps."
  } else if (parsedStampsRequired < DEFAULT_STAMPS_REQUIRED) {
    errors.stampsRequired = `Use at least ${DEFAULT_STAMPS_REQUIRED} visits.`
  } else if (parsedStampsRequired > MAX_STAMPS_REQUIRED) {
    errors.stampsRequired = `Use ${MAX_STAMPS_REQUIRED} visits or fewer.`
  }

  if (!rewardTerms) {
    errors.rewardTerms = "Enter clear mystery reward terms."
  } else if (rewardTerms.length < 12) {
    errors.rewardTerms =
      "Add enough detail for members to understand the offer."
  } else if (rewardTerms.length > 500) {
    errors.rewardTerms = "Use 500 characters or fewer."
  }

  if (
    Object.keys(errors).length ||
    parsedStampsRequired === null ||
    parsedRewardExpiryDays === null
  ) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("save_loyalty_card", {
    p_merchant_id: merchant.id,
    p_card_id: cardId || null,
    p_card_name: cardName,
    p_stamps_required: parsedStampsRequired,
    p_reward_name: "Surprise reward",
    p_reward_terms: rewardTerms,
    p_is_active: isActive,
    p_reward_expires_after_days: parsedRewardExpiryDays,
  })

  if (error) {
    return {
      fields,
      errors: {
        form: CARD_SAVE_ERROR,
      },
    }
  }

  const savedAction = data?.[0]?.saved_action

  await capturePostHogEvent({
    eventName: cardId ? "loyalty_card_updated" : "loyalty_card_created",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
  })

  revalidateMerchantLaunchSurfaces(merchant.id)
  // rewards explicitly (prefilled from the preset chips) on the rewards tab, so
  // nothing is auto-seeded to the database.
  redirect(
    savedAction === "loyalty_card_created"
      ? "/app/launch?tab=rewards"
      : "/app/launch?tab=card&saved=1"
  )
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
      "Add enough detail for members to understand the offer."
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
        form: rewardPoolMutationError(error, REWARD_SAVE_ERROR),
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

  const { provisioned, created } = await autoProvisionJoinQrFromSetup()

  revalidateMerchantLaunchSurfaces(merchant.id)

  return {
    fields: {
      ...fields,
      rewardPoolItemId:
        data?.[0]?.reward_pool_item_id ?? fields.rewardPoolItemId,
    },
    saved: true,
    qrStatus: provisioned ? (created ? "created" : "enabled") : undefined,
  }
}

export async function addRewardPresetsAction(
  _state: RewardPresetBatchActionState,
  formData: FormData
): Promise<RewardPresetBatchActionState> {
  const loyaltyCardId = value(formData, "loyaltyCardId")
  const submittedPresetIds = formData
    .getAll("presetId")
    .filter((entry): entry is string => typeof entry === "string")
  let fields = {
    loyaltyCardId,
    presetIds: [...new Set(submittedPresetIds.map((id) => id.trim()))]
      .filter(Boolean)
      .slice(0, MAX_REWARD_PRESET_BATCH),
  }
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return {
      fields,
      errors: {
        form: "Your session expired before we could add these. Nothing was changed. Your choices are still selected — sign in again to continue.",
      },
    }
  }

  if (!loyaltyCardId) {
    return {
      fields,
      errors: {
        form: "Save the mystery card before adding rewards. Nothing was changed.",
      },
    }
  }

  let presets
  try {
    presets = resolveRewardPresetsByIds(
      merchant.business_type,
      submittedPresetIds
    )
  } catch {
    return {
      fields: { loyaltyCardId, presetIds: [] },
      errors: {
        form: "Those reward choices are no longer available. Nothing was changed — refresh and choose again.",
      },
    }
  }

  fields = {
    loyaltyCardId,
    presetIds: presets.map((preset) => preset.id),
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("add_reward_pool_presets", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: loyaltyCardId,
    p_presets: presets.map((preset) => ({
      preset_id: preset.id,
      reward_name: preset.rewardName,
      reward_terms: preset.rewardTerms,
    })),
  })

  if (error) {
    return {
      fields,
      errors: {
        form: isDefiniteRewardPresetRollbackCode(error.code)
          ? REWARD_PRESET_ROLLBACK_ERROR
          : REWARD_PRESET_CONFIRMATION_ERROR,
      },
    }
  }

  if (!Array.isArray(data) || data.length !== presets.length) {
    return {
      fields,
      errors: {
        form: REWARD_PRESET_CONFIRMATION_ERROR,
      },
    }
  }

  const items: RewardPresetBatchItem[] = data.map((row) => ({
    id: String(row.reward_pool_item_id),
    rewardName: String(row.reward_name),
    rewardTerms: String(row.reward_terms),
    weight: String(row.weight),
    displayOrder: String(row.display_order),
    isActive: row.is_active === true,
    presetId: String(row.preset_id),
    savedAction:
      row.saved_action === "reward_pool_item_existing"
        ? "reward_pool_item_existing"
        : "reward_pool_item_created",
  }))
  const addedCount = items.filter(
    (item) => item.savedAction === "reward_pool_item_created"
  ).length
  const existingCount = items.length - addedCount
  const activeRewardCount = Number(data.at(-1)?.active_reward_count ?? 0)
  let qrStatus: "created" | "enabled" | undefined

  try {
    const { provisioned, created } = await autoProvisionJoinQrFromSetup()
    if (provisioned) qrStatus = created ? "created" : "enabled"
  } catch {
    // The atomic reward write is authoritative. A safe idempotent retry can
    // heal QR provisioning without turning a committed batch into a false red.
  }

  revalidateMerchantLaunchSurfaces(merchant.id)

  const message =
    addedCount === 0
      ? "Those rewards are already in your pool. Nothing new was added."
      : existingCount > 0
        ? `${addedCount} reward${addedCount === 1 ? "" : "s"} added. ${existingCount} ${existingCount === 1 ? "was" : "were"} already in your pool.`
        : `${addedCount} reward${addedCount === 1 ? "" : "s"} added.`

  return {
    fields,
    items,
    saved: true,
    addedCount,
    existingCount,
    activeRewardCount,
    message,
    qrStatus,
  }
}

export type BirthdayRewardActionState = {
  fields?: {
    loyaltyCardId?: string
    enabled?: boolean
    rewardName?: string
    rewardTerms?: string
  }
  errors?: {
    rewardName?: string
    rewardTerms?: string
    form?: string
  }
  saved?: boolean
  message?: string
}

const BIRTHDAY_SAVE_ERROR =
  "Birthday reward could not be saved. Check your details and try again."

export async function saveBirthdayRewardAction(
  _state: BirthdayRewardActionState,
  formData: FormData
): Promise<BirthdayRewardActionState> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return {
      errors: {
        form: "Complete merchant onboarding before saving a birthday reward.",
      },
    }
  }

  const loyaltyCardId = value(formData, "loyaltyCardId")
  const enabled = formData.get("enabled") === "on"
  const rewardName = value(formData, "rewardName")
  const rewardTerms = value(formData, "rewardTerms")
  const fields = { loyaltyCardId, enabled, rewardName, rewardTerms }
  const errors: NonNullable<BirthdayRewardActionState["errors"]> = {}

  if (!loyaltyCardId) {
    errors.form = "Save your mystery card before setting up a birthday reward."
  }

  // Enabling requires both fields; the length ceilings apply whenever a value is
  // present so stored copy stays valid after a disable/re-enable.
  if (enabled && !rewardName) {
    errors.rewardName = "Enter the birthday reward name."
  } else if (rewardName.length > 100) {
    errors.rewardName = "Use 100 characters or fewer."
  }

  if (enabled && !rewardTerms) {
    errors.rewardTerms = "Enter clear birthday reward terms."
  } else if (rewardTerms && rewardTerms.length < 12) {
    errors.rewardTerms =
      "Add enough detail for members to understand the offer."
  } else if (rewardTerms.length > 500) {
    errors.rewardTerms = "Use 500 characters or fewer."
  }

  if (Object.keys(errors).length) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("save_loyalty_card_birthday_reward", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: loyaltyCardId,
    p_enabled: enabled,
    p_reward_name: rewardName || null,
    p_reward_terms: rewardTerms || null,
  })

  if (error) {
    return { fields, errors: { form: BIRTHDAY_SAVE_ERROR } }
  }

  await capturePostHogEvent({
    eventName: enabled ? "birthday_reward_enabled" : "birthday_reward_disabled",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: { loyalty_card_id: loyaltyCardId },
  })

  revalidateMerchantLaunchSurfaces(merchant.id)
  return {
    fields,
    saved: true,
    message: enabled ? "Birthday treat saved." : "Birthday treat switched off.",
  }
}

export async function toggleRewardPoolItemActiveAction(formData: FormData) {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return { error: "Complete merchant onboarding before updating rewards." }
  }

  const rewardPoolItemId = value(formData, "rewardPoolItemId")
  const loyaltyCardId = value(formData, "loyaltyCardId")
  const nextActive = formData.get("nextActive") === "true"

  if (!rewardPoolItemId || !loyaltyCardId) {
    return { error: REWARD_UPDATE_ERROR }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("set_reward_pool_item_active", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: loyaltyCardId,
    p_reward_pool_item_id: rewardPoolItemId,
    p_is_active: nextActive,
  })

  if (error) {
    return { error: rewardPoolMutationError(error) }
  }

  await capturePostHogEvent({
    eventName: nextActive
      ? "reward_pool_item_activated"
      : "reward_pool_item_deactivated",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: {
      loyalty_card_id: loyaltyCardId,
      reward_pool_item_id: rewardPoolItemId,
    },
  })

  let qrStatus: "created" | "enabled" | undefined

  if (nextActive) {
    const { provisioned, created } = await autoProvisionJoinQrFromSetup()
    if (provisioned) {
      qrStatus = created ? "created" : "enabled"
    }
  }

  revalidateMerchantLaunchSurfaces(merchant.id)
  return { ok: true as const, qrStatus }
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
      `/app/launch?tab=rewards&error=${encodeURIComponent(
        rewardPoolMutationError(error)
      )}`
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

  revalidateMerchantLaunchSurfaces(merchant.id)

  redirect("/app/launch?tab=rewards&saved=pool")
}
