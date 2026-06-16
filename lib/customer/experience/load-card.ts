import "server-only"

import {
  getCustomerCardState,
  getMembershipStampDisplayDates,
  reconcileCardStampCount,
} from "@/lib/customer/card"
import { captureJoinFunnelEvent } from "@/lib/customer/join-funnel"
import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"
import { isRedeemableFrom, ukTodayIso } from "@/lib/customer/uk-date"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"
import { logger } from "@/lib/observability/logger"

import type { CardContext } from "./derive"

type CardSearchParams = {
  stamp?: string
  reward?: string
  geo?: string
  welcome?: string
  firststamp?: string
}

/**
 * Impure loader for the card route: fetch the card state, fold in the
 * `?stamp=issued` / `?reward=redeemed` / `?geo=flagged` / `?welcome=1` flags, and
 * hand pure facts to {@link deriveCustomerExperience}. No JSX, no copy.
 */
export async function loadCardExperienceContext(
  membershipId: string,
  searchParams: CardSearchParams
): Promise<CardContext> {
  const cardState = await getCustomerCardState(membershipId)

  if (cardState.status !== "ready") {
    return {
      access: cardState.status,
      recovery:
        cardState.status === "unauthenticated"
          ? { loginHref: customerLoginHref(`/card/${membershipId}`) }
          : undefined,
    }
  }

  const { membership, merchant, loyaltyCard, latestReward } = cardState
  await captureJoinFunnelEvent({
    eventName: "customer_card_viewed",
    merchantId: merchant.id,
    membershipId: membership.id,
    merchantSlug: merchant.business_slug,
    metadata: {
      source: "card_route",
    },
  })

  const justStamped = searchParams.stamp === "issued"
  const justRedeemed = searchParams.reward === "redeemed"
  const geoFlagged = searchParams.geo === "flagged"
  const justJoined = searchParams.welcome === "1"
  const firstStampPending = searchParams.firststamp === "pending"

  if (!loyaltyCard) {
    return baseUnavailable(
      membership.id,
      merchant.business_name,
      "This loyalty card is unavailable.",
      { justStamped, justJoined, justRedeemed, geoFlagged }
    )
  }

  if (cardState.unavailableReason) {
    return baseUnavailable(
      membership.id,
      merchant.business_name,
      cardState.unavailableReason,
      { justStamped, justJoined, justRedeemed, geoFlagged }
    )
  }

  const target = loyaltyCard.stamps_required
  const stampDates = await getMembershipStampDisplayDates(
    membership.id,
    target,
    membership.active_cycle_number
  )
  const current = reconcileCardStampCount({
    membershipCount: membership.current_stamp_count,
    stampDateCount: stampDates.length,
    total: target,
  })
  const dates =
    justStamped && current > stampDates.length
      ? [
          ...stampDates,
          ...Array.from({ length: current - stampDates.length }, () =>
            formatStampDisplayDateFromIso(ukTodayIso())
          ),
        ]
      : stampDates.slice(0, current)
  const reward =
    latestReward?.status === "unlocked"
      ? {
          id: latestReward.id,
          name: latestReward.reward_name,
          terms: latestReward.reward_terms,
          minSpendPence: latestReward.min_spend_pence,
          redeemableFrom: latestReward.redeemable_from,
          redeemable: isRedeemableFrom(latestReward.redeemable_from),
        }
      : null

  // The RPC unlocks a reward at `current_stamp_count >= stamps_required`. If the
  // count is full but no unlocked reward row exists, the data has drifted: show a
  // recovery state rather than inviting a stamp the RPC would reject.
  const fullWithoutReward = membership.current_stamp_count >= target && !reward
  if (fullWithoutReward) {
    logger.warn("customer_full_card_without_reward", {
      membershipId: membership.id,
      route: "card",
      currentStampCount: membership.current_stamp_count,
      stampsRequired: target,
    })
  }

  return {
    membershipId: membership.id,
    merchantName: merchant.business_name,
    cardName: loyaltyCard.card_name,
    current,
    total: target,
    fullWithoutReward,
    reward,
    rewardTerms: loyaltyCard.reward_terms,
    stampDates: dates,
    justStamped,
    justJoined,
    firstStampPending,
    geoFlagged,
    justRedeemed,
  }
}

function baseUnavailable(
  membershipId: string,
  merchantName: string,
  unavailableReason: string,
  flags: {
    justStamped: boolean
    justJoined: boolean
    justRedeemed: boolean
    geoFlagged: boolean
  }
): CardContext {
  return {
    unavailableReason,
    membershipId,
    merchantName,
    cardName: "",
    current: 0,
    total: 0,
    reward: null,
    rewardTerms: "",
    stampDates: [],
    justStamped: flags.justStamped,
    justJoined: flags.justJoined,
    geoFlagged: flags.geoFlagged,
    justRedeemed: flags.justRedeemed,
  }
}
