import "server-only"

import { DEFAULT_REWARD_POOL_ITEMS } from "@/lib/merchant/default-reward-pool"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>

const DEFAULT_ACTIVE_REWARD_TARGET = DEFAULT_REWARD_POOL_ITEMS.filter(
  (item) => item.isActive
).length

export async function seedDefaultRewardPoolIfEmpty(
  supabase: SupabaseServerClient,
  merchantId: string,
  loyaltyCardId: string
): Promise<boolean> {
  // Read the existing slots so a previous partial seed (each upsert is its own
  // transaction) self-heals: we gate on the active-reward target rather than a
  // bare length === 0, and only insert the default slots that are still missing
  // so a re-run never duplicates the rows that already committed.
  const { data: existing, error: existingError } = await supabase
    .from("reward_pool_items")
    .select("display_order, is_active")
    .eq("merchant_id", merchantId)
    .eq("loyalty_card_id", loyaltyCardId)

  if (existingError) {
    return false
  }

  const existingItems = existing ?? []
  const activeCount = existingItems.filter((item) => item.is_active).length

  if (activeCount >= DEFAULT_ACTIVE_REWARD_TARGET) {
    return false
  }

  const occupiedOrders = new Set(
    existingItems.map((item) => item.display_order)
  )
  const itemsToSeed = DEFAULT_REWARD_POOL_ITEMS.filter(
    (item) => !occupiedOrders.has(item.displayOrder)
  )

  if (itemsToSeed.length === 0) {
    return false
  }

  for (const item of itemsToSeed) {
    const { error } = await supabase.rpc("upsert_reward_pool_item", {
      p_merchant_id: merchantId,
      p_loyalty_card_id: loyaltyCardId,
      p_reward_pool_item_id: null,
      p_reward_name: item.rewardName,
      p_reward_terms: item.rewardTerms,
      p_weight: item.weight,
      p_is_active: item.isActive,
      p_display_order: item.displayOrder,
    })

    if (error) {
      return false
    }
  }

  return true
}

export async function seedDefaultRewardPoolForCardIfEmpty(
  merchantId: string,
  loyaltyCardId: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  return seedDefaultRewardPoolIfEmpty(supabase, merchantId, loyaltyCardId)
}
