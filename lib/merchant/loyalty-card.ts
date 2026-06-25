import "server-only"

import { cache } from "react"

import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

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
}

export type RewardPoolItemSummary = {
  id: string
  reward_name: string
  reward_terms: string
  weight: number
  is_active: boolean
  display_order: number
}

export type LoyaltyCardSetup = {
  merchant: Awaited<ReturnType<typeof getCurrentMerchant>>
  location: MerchantLocationSummary | null
  card: LoyaltyCardSummary | null
  rewardPoolItems: RewardPoolItemSummary[]
}

async function getLoyaltyCardSetupUncached(): Promise<LoyaltyCardSetup> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return { merchant: null, location: null, card: null, rewardPoolItems: [] }
  }

  const supabase = await createSupabaseServerClient()
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
      "id, card_name, stamps_required, reward_name, reward_terms, is_active"
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
    .select("id, reward_name, reward_terms, weight, is_active, display_order")
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

export const getLoyaltyCardSetup = cache(getLoyaltyCardSetupUncached)
