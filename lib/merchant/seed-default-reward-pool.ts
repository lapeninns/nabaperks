import "server-only"

import { DEFAULT_REWARD_POOL_ITEMS } from "@/lib/merchant/default-reward-pool"
import type { createSupabaseServerClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>

export async function seedDefaultRewardPoolIfEmpty(
  supabase: SupabaseServerClient,
  merchantId: string,
  loyaltyCardId: string
): Promise<boolean> {
  const { count, error: countError } = await supabase
    .from("reward_pool_items")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("loyalty_card_id", loyaltyCardId)

  if (countError || (count ?? 0) > 0) {
    return false
  }

  for (const item of DEFAULT_REWARD_POOL_ITEMS) {
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
