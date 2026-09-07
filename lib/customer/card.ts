import "server-only"

import { loyaltyAvailability } from "@/lib/customer/availability"
import { legacyGetCustomerCardState } from "@/lib/customer/card-legacy-read"
import {
  parseCustomerCardStateRow,
  toRewardSummary,
} from "@/lib/customer/card-state-row"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  pickIssuedUnlockedReward,
  pickStampBlockingUnlockedReward,
} from "@/lib/customer/primary-reward"
import { isMissingRpcError } from "@/lib/supabase/missing-rpc"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export {
  getMembershipStampDisplayDates,
  getMembershipStampDisplayDatesByMembership,
  reconcileCardStampCount,
  stampDisplayLabelsForCount,
  type MembershipStampDisplayDates,
} from "@/lib/customer/card-stamps"

export type CustomerCardState =
  | { status: "unauthenticated" | "unauthorized" | "not_found" }
  | {
      status: "ready"
      unavailableReason?: string
      membership: {
        id: string
        current_stamp_count: number
        total_rewards_redeemed: number
        active_cycle_number: number
        referral_code: string
        referral_code_active: boolean
      }
      merchant: {
        id: string
        business_name: string
        business_slug: string
        status: string
        pub_google_review: string | null
        locals: string | null
      }
      loyaltyCard: {
        card_name: string
        stamps_required: number
        reward_name: string
        reward_terms: string
        is_active: boolean
      } | null
      /** Unlocked stamp-cycle reward only — the card's own completion reward. */
      stampCycleReward: {
        id: string
        status: string
        reward_name: string
        reward_terms: string
        redeemable_from: string | null
        expires_at: string | null
        source: string | null
      } | null
      /** Best unlocked issued reward (birthday/merchant) — the card's gift rail,
       *  kept separate so it never drives the stamp-cycle completion state. */
      issuedReward: {
        id: string
        status: string
        reward_name: string
        reward_terms: string
        redeemable_from: string | null
        expires_at: string | null
        source: string | null
      } | null
      billingStatus: string | null
    }

export async function getCustomerCardState(
  membershipId: string
): Promise<CustomerCardState> {
  const currentCustomer = await getCurrentCustomer()

  if (!currentCustomer) return { status: "unauthenticated" }

  // One hop: membership, merchant, card, unlocked rewards and billing. The RPC
  // proves ownership against the session's customer id before it reads any
  // detail; a non-owner receives a bare status.
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("get_customer_card_state", {
    p_membership_id: membershipId,
    p_customer_id: currentCustomer.id,
  })

  if (error) {
    if (isMissingRpcError(error)) {
      // App deployed ahead of the migration: previous multi-query read, for
      // one release.
      return legacyGetCustomerCardState(currentCustomer.id, membershipId)
    }
    throw new Error(`Unable to load customer card: ${error.message}`)
  }

  const state = parseCustomerCardStateRow(data)
  if (state.status === "not_found") return { status: "not_found" }
  if (state.status === "unauthorized") return { status: "unauthorized" }

  const { membership, merchant, loyaltyCard, unlockedRewards, billingStatus } =
    state

  // Belt and braces: the database already refused a non-owner, and the row it
  // returned must still name the session's customer.
  if (membership.customer_id !== currentCustomer.id) {
    return { status: "unauthorized" }
  }

  const unavailableReason = unavailableMessage(
    merchant.status,
    loyaltyCard?.is_active ?? false,
    billingStatus,
    merchant.requires_billing
  )

  const stampCycleReward = pickStampBlockingUnlockedReward(unlockedRewards)
  const issuedReward = pickIssuedUnlockedReward(unlockedRewards)

  return {
    status: "ready",
    unavailableReason,
    membership: {
      id: membership.id,
      current_stamp_count: membership.current_stamp_count,
      total_rewards_redeemed: membership.total_rewards_redeemed,
      active_cycle_number: membership.active_cycle_number,
      referral_code: membership.referral_code,
      referral_code_active: membership.referral_code_active,
    },
    merchant: {
      id: membership.merchant_id,
      business_name: merchant.business_name,
      business_slug: merchant.business_slug,
      status: merchant.status,
      pub_google_review: merchant.pub_google_review,
      locals: merchant.locals,
    },
    loyaltyCard,
    stampCycleReward: toRewardSummary(stampCycleReward),
    issuedReward: toRewardSummary(issuedReward),
    billingStatus,
  }
}

export function unavailableMessage(
  merchantStatus: string,
  cardActive: boolean,
  billingStatus: string | null,
  requiresBilling = false
) {
  return loyaltyAvailability({
    merchantStatus,
    cardActive,
    billingStatus,
    requiresBilling,
  }).message
}
