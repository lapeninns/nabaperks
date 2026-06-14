import "server-only"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type CustomerCardState =
  | { status: "unauthenticated" | "unauthorized" | "not_found" }
  | {
      status: "ready"
      unavailableReason?: string
      membership: {
        id: string
        current_stamp_count: number
        total_rewards_redeemed: number
      }
      merchant: {
        id: string
        business_name: string
        business_slug: string
        status: string
      }
      loyaltyCard: {
        card_name: string
        stamps_required: number
        reward_name: string
        reward_terms: string
        min_spend_pence: number | null
        is_active: boolean
      } | null
      latestReward: {
        id: string
        status: string
        reward_name: string
        reward_terms: string
        min_spend_pence: number | null
        redeemable_from: string | null
      } | null
      billingStatus: string | null
    }

type RawMembership = {
  id: string
  merchant_id: string
  customer_id: string
  current_stamp_count: number
  total_rewards_redeemed: number
  merchants:
    | {
        business_name: string
        business_slug: string
        status: string
      }
    | Array<{
        business_name: string
        business_slug: string
        status: string
      }>
}

type RawMembershipStampEvent = {
  membership_id: string
  earned_business_date: string | null
}

export type MembershipStampDisplayDates = {
  readonly stampDates: string[]
  readonly latestBusinessDate: string | null
}

/** Receipt-style labels for earned stamps, oldest first. */
export async function getMembershipStampDisplayDates(
  membershipId: string,
  limit: number
): Promise<string[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("stamp_events")
    .select("earned_business_date")
    .eq("membership_id", membershipId)
    .eq("event_type", "earned")
    .order("earned_business_date", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Unable to load stamp dates: ${error.message}`)
  }

  return (data ?? [])
    .map((row) => row.earned_business_date)
    .filter((date): date is string => typeof date === "string")
    .map(formatStampDisplayDateFromIso)
}

export async function getMembershipStampDisplayDatesByMembership(
  membershipIds: readonly string[],
  limitByMembership: number
): Promise<Map<string, MembershipStampDisplayDates>> {
  const uniqueMembershipIds = [...new Set(membershipIds)]
  const stampDatesByMembership = new Map<string, MembershipStampDisplayDates>()

  for (const membershipId of uniqueMembershipIds) {
    stampDatesByMembership.set(membershipId, {
      stampDates: [],
      latestBusinessDate: null,
    })
  }

  if (uniqueMembershipIds.length === 0) return stampDatesByMembership

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("stamp_events")
    .select("membership_id, earned_business_date")
    .in("membership_id", uniqueMembershipIds)
    .eq("event_type", "earned")
    .order("earned_business_date", { ascending: true })

  if (error) {
    throw new Error(`Unable to load stamp dates: ${error.message}`)
  }

  const rawDatesByMembership = new Map<string, string[]>()
  for (const row of (data ?? []) as RawMembershipStampEvent[]) {
    if (typeof row.earned_business_date !== "string") continue

    const dates = rawDatesByMembership.get(row.membership_id) ?? []
    if (dates.length < limitByMembership) {
      dates.push(row.earned_business_date)
      rawDatesByMembership.set(row.membership_id, dates)
    }
  }

  for (const [membershipId, rawDates] of rawDatesByMembership) {
    stampDatesByMembership.set(membershipId, {
      stampDates: rawDates.map(formatStampDisplayDateFromIso),
      latestBusinessDate: rawDates.at(-1) ?? null,
    })
  }

  return stampDatesByMembership
}

export function reconcileCardStampCount({
  membershipCount,
  stampDateCount,
  total,
}: {
  membershipCount: number
  stampDateCount: number
  total: number
}) {
  return Math.min(Math.max(membershipCount, stampDateCount), total)
}

export async function getCustomerCardState(
  membershipId: string
): Promise<CustomerCardState> {
  const currentCustomer = await getCurrentCustomer()

  if (!currentCustomer) return { status: "unauthenticated" }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, merchant_id, customer_id, current_stamp_count, total_rewards_redeemed, merchants(business_name, business_slug, status)"
    )
    .eq("id", membershipId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load customer card: ${error.message}`)
  }

  if (!data) return { status: "not_found" }

  const membership = data as RawMembership
  const merchant = first(membership.merchants)

  if (membership.customer_id !== currentCustomer.id) {
    return { status: "unauthorized" }
  }

  const { data: loyaltyCard, error: cardError } = await supabase
    .from("loyalty_cards")
    .select(
      "card_name, stamps_required, reward_name, reward_terms, min_spend_pence, is_active"
    )
    .eq("merchant_id", membership.merchant_id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (cardError) {
    throw new Error(`Unable to load loyalty card: ${cardError.message}`)
  }

  const { data: latestReward, error: rewardError } = await supabase
    .from("reward_events")
    .select(
      "id, status, reward_name, reward_terms, min_spend_pence, redeemable_from"
    )
    .eq("membership_id", membership.id)
    .eq("status", "unlocked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (rewardError) {
    throw new Error(`Unable to load reward status: ${rewardError.message}`)
  }

  const { data: billing, error: billingError } = await supabase
    .from("billing_customers")
    .select("status")
    .eq("merchant_id", membership.merchant_id)
    .maybeSingle()

  if (billingError) {
    throw new Error(`Unable to load billing status: ${billingError.message}`)
  }

  const unavailableReason = unavailableMessage(
    merchant.status,
    loyaltyCard?.is_active ?? false,
    billing?.status ?? null
  )

  return {
    status: "ready",
    unavailableReason,
    membership: {
      id: membership.id,
      current_stamp_count: membership.current_stamp_count,
      total_rewards_redeemed: membership.total_rewards_redeemed,
    },
    merchant: {
      id: membership.merchant_id,
      business_name: merchant.business_name,
      business_slug: merchant.business_slug,
      status: merchant.status,
    },
    loyaltyCard,
    latestReward: latestReward
      ? {
          id: latestReward.id,
          status: latestReward.status,
          reward_name: latestReward.reward_name,
          reward_terms: latestReward.reward_terms,
          min_spend_pence: latestReward.min_spend_pence,
          redeemable_from: latestReward.redeemable_from,
        }
      : null,
    billingStatus: billing?.status ?? null,
  }
}

export function unavailableMessage(
  merchantStatus: string,
  cardActive: boolean,
  billingStatus: string | null
) {
  if (!["trial", "active"].includes(merchantStatus)) {
    return "This merchant loyalty programme is not currently active."
  }

  if (!cardActive) {
    return "This loyalty card is not currently active."
  }

  if (billingStatus === "suspended") {
    return "This loyalty programme is unavailable at the moment."
  }

  return undefined
}

function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}
