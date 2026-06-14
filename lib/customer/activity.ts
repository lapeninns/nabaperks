import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { firstOf, getCurrentCustomer } from "@/lib/customer/identity"

const customerActivityEvents = [
  "customer_joined",
  "stamp_issued",
  "reward_unlocked",
  "reward_redeemed",
] as const

export type CustomerActivityCategory = "join" | "stamp" | "reward"

export type CustomerActivityItem = {
  id: string
  eventName: string
  category: CustomerActivityCategory
  badgeLabel: string
  title: string
  description: string
  businessName: string | null
  createdAt: string
}

type RawCustomerActivityRow = {
  id: string
  event_name: string
  created_at: string
  metadata: Record<string, unknown> | null
  merchants: { business_name: string } | Array<{ business_name: string }> | null
}

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100

/**
 * The signed-in customer's own activity stream — joins, stamps, and rewards
 * across every venue, newest first. A lean, customer-scoped counterpart to the
 * merchant feed in `getEnrichedMerchantActivity` ([lib/merchant/activity.ts]).
 */
export async function getCustomerActivity(
  limit = DEFAULT_LIMIT
): Promise<CustomerActivityItem[]> {
  const customer = await getCurrentCustomer()

  if (!customer) return []

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("product_events")
    .select("id, event_name, created_at, metadata, merchants(business_name)")
    .eq("customer_id", customer.id)
    .in("event_name", [...customerActivityEvents])
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))

  if (error) {
    throw new Error(`Unable to load activity: ${error.message}`)
  }

  const rows = (data ?? []) as RawCustomerActivityRow[]

  return rows.map((row) => toCustomerActivityItem(row))
}

function toCustomerActivityItem(row: RawCustomerActivityRow): CustomerActivityItem {
  const merchant = firstOf(row.merchants)
  const businessName = merchant?.business_name ?? null
  const venue = businessName ?? "a venue"
  const metadata = row.metadata ?? {}
  const rewardName =
    typeof metadata.reward_name === "string" ? metadata.reward_name : undefined
  const stampCount =
    typeof metadata.new_stamp_count === "number"
      ? metadata.new_stamp_count
      : undefined

  switch (row.event_name) {
    case "customer_joined":
      return base(row, "join", "Joined", `Joined ${venue}`, `You started collecting stamps at ${venue}.`, businessName)
    case "stamp_issued":
      return base(
        row,
        "stamp",
        "Stamp",
        `Stamp added at ${venue}`,
        stampCount !== undefined
          ? `You're now on ${stampCount} ${stampCount === 1 ? "stamp" : "stamps"}.`
          : "A stamp was added to your card.",
        businessName
      )
    case "reward_unlocked":
      return base(
        row,
        "reward",
        "Reward",
        `Reward unlocked at ${venue}`,
        rewardName ? `${rewardName} is ready to claim.` : "A reward is ready to claim.",
        businessName
      )
    case "reward_redeemed":
      return base(
        row,
        "reward",
        "Redeemed",
        `Reward redeemed at ${venue}`,
        rewardName ? `You enjoyed ${rewardName}.` : "You redeemed a reward.",
        businessName
      )
    default:
      return base(row, "join", "Update", `Activity at ${venue}`, "Loyalty activity recorded.", businessName)
  }
}

function base(
  row: RawCustomerActivityRow,
  category: CustomerActivityCategory,
  badgeLabel: string,
  title: string,
  description: string,
  businessName: string | null
): CustomerActivityItem {
  return {
    id: row.id,
    eventName: row.event_name,
    category,
    badgeLabel,
    title,
    description,
    businessName,
    createdAt: row.created_at,
  }
}
