import "server-only"

import { getCustomerCardState } from "@/lib/customer/card"
import { isRedeemableFrom } from "@/lib/customer/uk-date"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"

import type { CardContext } from "./derive"

type CardSearchParams = {
  stamp?: string
  reward?: string
  geo?: string
  welcome?: string
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
  const justStamped = searchParams.stamp === "issued"
  const justRedeemed = searchParams.reward === "redeemed"
  const geoFlagged = searchParams.geo === "flagged"
  const justJoined = searchParams.welcome === "1"

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

  return {
    membershipId: membership.id,
    merchantName: merchant.business_name,
    cardName: loyaltyCard.card_name,
    current: Math.min(membership.current_stamp_count, target),
    total: target,
    stampsBlocked: cardState.billingStatus === "cancelled",
    reward,
    rewardTerms: loyaltyCard.reward_terms,
    justStamped,
    justJoined,
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
    stampsBlocked: false,
    reward: null,
    rewardTerms: "",
    justStamped: flags.justStamped,
    justJoined: flags.justJoined,
    geoFlagged: flags.geoFlagged,
    justRedeemed: flags.justRedeemed,
  }
}
