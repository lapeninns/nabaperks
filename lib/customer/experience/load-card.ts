import "server-only"

import {
  getCustomerCardState,
  getMembershipStampDisplayDates,
  reconcileCardStampCount,
  stampDisplayLabelsForCount,
} from "@/lib/customer/card"
import { captureJoinFunnelEvent } from "@/lib/customer/join-funnel"
import { getJoinFirstStampRecovery } from "@/lib/customer/join-first-stamp-recovery"
import { getReferralBonusBank } from "@/lib/customer/referral-bonus-bank"
import {
  buildReferralJoinUrl,
  isShareableReferralCode,
} from "@/lib/customer/referral"
import {
  narrowRewardSource,
  rewardStampThresholdMet,
} from "@/lib/customer/issued-reward-display"
import { isRedeemableFrom } from "@/lib/customer/uk-date"
import {
  normalizeGoogleReviewUrl,
  normalizeVenueLocality,
} from "@/lib/customer/venue-details"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"
import { logger } from "@/lib/observability/logger"

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

  const { membership, merchant, loyaltyCard, stampCycleReward, issuedReward } =
    cardState
  await captureJoinFunnelEvent({
    eventName: "customer_card_viewed",
    merchantId: merchant.id,
    membershipId: membership.id,
    step: "card",
    surface: "customer_card",
  })

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
  const [stampDates, referralBonusBank, firstStampRecovery] = await Promise.all(
    [
      getMembershipStampDisplayDates(
        membership.id,
        target,
        membership.active_cycle_number
      ),
      getReferralBonusBank(membership.id),
      getJoinFirstStampRecovery(membership.id),
    ]
  )
  const current = reconcileCardStampCount({
    membershipCount: membership.current_stamp_count,
    total: target,
  })
  const dates = stampDisplayLabelsForCount({
    labels: stampDates,
    count: current,
  })
  // The card face reflects the STAMP-CYCLE reward only — the reward earned by
  // completing this card. Issued rewards (birthday/merchant) never drive it, so
  // an incomplete card never reads as reward-ready.
  const reward =
    stampCycleReward?.status === "unlocked"
      ? {
          id: stampCycleReward.id,
          name: stampCycleReward.reward_name,
          terms: stampCycleReward.reward_terms,
          redeemableFrom: stampCycleReward.redeemable_from,
          redeemable:
            isRedeemableFrom(stampCycleReward.redeemable_from) &&
            rewardStampThresholdMet(
              stampCycleReward.source,
              membership.current_stamp_count,
              target
            ),
        }
      : null

  // The gift rail: an issued reward shown as a distinct chip beside the card,
  // redeemable on its own terms (no stamp threshold), independent of card state.
  const giftReward =
    issuedReward?.status === "unlocked"
      ? {
          id: issuedReward.id,
          name: issuedReward.reward_name,
          source: narrowRewardSource(issuedReward.source),
          redeemableFrom: issuedReward.redeemable_from,
          redeemable: isRedeemableFrom(issuedReward.redeemable_from),
        }
      : null

  // The RPC unlocks a reward at `current_stamp_count >= stamps_required`. If the
  // count is full but no unlocked stamp-cycle reward row exists, the data has
  // drifted: show a recovery state rather than inviting a stamp the RPC rejects.
  const fullWithoutReward = membership.current_stamp_count >= target && !reward
  if (fullWithoutReward) {
    logger.warn("customer_full_card_without_reward", {
      membershipId: membership.id,
      route: "card",
      currentStampCount: membership.current_stamp_count,
      stampsRequired: target,
    })
  }

  const referralShareUrl =
    membership.referral_code_active &&
    isShareableReferralCode(membership.referral_code)
      ? buildReferralJoinUrl(merchant.business_slug, membership.referral_code)
      : undefined

  return {
    membershipId: membership.id,
    merchantName: merchant.business_name,
    locality: normalizeVenueLocality(merchant.locals),
    googleReviewUrl: normalizeGoogleReviewUrl(merchant.pub_google_review),
    cardName: loyaltyCard.card_name,
    current,
    total: target,
    fullWithoutReward,
    reward,
    giftReward,
    rewardTerms: loyaltyCard.reward_terms,
    stampDates: dates,
    justStamped,
    justJoined,
    firstStampRecovery,
    geoFlagged,
    justRedeemed,
    referralShareUrl,
    referralBonusBank,
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
