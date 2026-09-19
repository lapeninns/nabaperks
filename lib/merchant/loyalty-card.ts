import "server-only"

import { cache } from "react"

import { getCurrentMerchant } from "@/lib/auth/session"
import {
  cacheByScope,
  loyaltyCardSetupCacheTag,
  merchantCacheTag,
} from "@/lib/cache/tags"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import type {
  CollectionWindowSummary,
  VenueClosureSummary,
} from "@/lib/merchant/collection-window-fields"

export type MerchantLocationSummary = {
  id: string
  name: string
}

export type LoyaltyCardSummary = {
  id: string
  card_name: string
  stamps_required: number
  reward_name: string
  reward_terms: string
  is_active: boolean
  /** Days an earned reward stays claimable before it lapses and frees the card. */
  reward_expires_after_days: number | null
  birthday_reward_enabled: boolean
  birthday_reward_name: string | null
  birthday_reward_terms: string | null
  birthday_reward_requires_age_check: boolean
  minimum_spend_pence: number | null
  one_transaction_per_stamp: boolean
}

export type RewardPoolItemSummary = {
  id: string
  reward_name: string
  reward_terms: string
  weight: number
  is_active: boolean
  display_order: number
  requires_age_check: boolean
}

export type LoyaltyCardSetup = {
  merchant: Awaited<ReturnType<typeof getCurrentMerchant>>
  location: MerchantLocationSummary | null
  card: LoyaltyCardSummary | null
  rewardPoolItems: RewardPoolItemSummary[]
}

type CurrentMerchant = NonNullable<
  Awaited<ReturnType<typeof getCurrentMerchant>>
>

function emptySetup(): LoyaltyCardSetup {
  return { merchant: null, location: null, card: null, rewardPoolItems: [] }
}

async function getLoyaltyCardSetupForCurrentMerchant(): Promise<LoyaltyCardSetup> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return emptySetup()
  }

  return cacheByScope(
    () => loadLoyaltyCardSetup(merchant),
    ["loyalty-card-setup", merchant.id],
    [merchantCacheTag(merchant.id), loyaltyCardSetupCacheTag(merchant.id)]
  )
}

async function loadLoyaltyCardSetup(
  merchant: CurrentMerchant
): Promise<LoyaltyCardSetup> {
  const supabase = createSupabaseServiceRoleClient()
  const { data: location, error: locationError } = await supabase
    .from("merchant_locations")
    .select("id, name")
    .eq("merchant_id", merchant.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (locationError) {
    throw new Error(
      `Unable to load merchant location: ${locationError.message}`
    )
  }

  if (!location) {
    return { merchant, location: null, card: null, rewardPoolItems: [] }
  }

  const { data: card, error: cardError } = await supabase
    .from("loyalty_cards")
    .select(
      "id, card_name, stamps_required, reward_name, reward_terms, is_active, reward_expires_after_days, birthday_reward_enabled, birthday_reward_name, birthday_reward_terms, birthday_reward_requires_age_check, minimum_spend_pence, one_transaction_per_stamp"
    )
    .eq("merchant_id", merchant.id)
    .eq("location_id", location.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (cardError) {
    throw new Error(`Unable to load loyalty card: ${cardError.message}`)
  }

  if (!card) {
    return { merchant, location, card: null, rewardPoolItems: [] }
  }

  const { data: rewardPoolItems, error: poolError } = await supabase
    .from("reward_pool_items")
    .select(
      "id, reward_name, reward_terms, weight, is_active, display_order, requires_age_check"
    )
    .eq("merchant_id", merchant.id)
    .eq("location_id", location.id)
    .eq("loyalty_card_id", card.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (poolError) {
    throw new Error(`Unable to load reward pool: ${poolError.message}`)
  }

  return {
    merchant,
    location,
    card,
    rewardPoolItems: rewardPoolItems ?? [],
  }
}

export const getLoyaltyCardSetup = cache(getLoyaltyCardSetupForCurrentMerchant)

export async function getCollectionSettings(
  merchantId: string,
  locationId: string
): Promise<{
  readonly windows: readonly CollectionWindowSummary[]
  readonly closures: readonly VenueClosureSummary[]
}> {
  return cacheByScope(
    async () => {
      const supabase = createSupabaseServiceRoleClient()
      const [windows, closures] = await Promise.all([
        supabase
          .from("venue_collection_windows")
          .select(
            "id, isodow, starts_at, ends_at, upgrade_pool_item_id, is_active"
          )
          .eq("merchant_id", merchantId)
          .eq("location_id", locationId)
          .eq("is_active", true)
          .order("isodow")
          .order("starts_at"),
        supabase
          .from("venue_closures")
          .select("id, starts_at, ends_at, reason, ended_early_at")
          .eq("merchant_id", merchantId)
          .eq("location_id", locationId)
          .is("ended_early_at", null)
          .order("starts_at"),
      ])
      if (windows.error || closures.error) {
        throw new Error("Unable to load collection windows and closures.")
      }
      return { windows: windows.data ?? [], closures: closures.data ?? [] }
    },
    ["venue-collection-settings", merchantId, locationId],
    [loyaltyCardSetupCacheTag(merchantId)]
  )
}
