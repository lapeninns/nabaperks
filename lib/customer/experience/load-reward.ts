import "server-only"

import { getCustomerRewardState } from "@/lib/customer/reward"
import { getLocationRequirement } from "@/lib/customer/stamp"
import {
  isRewardExpired,
  rewardStampThresholdMet,
} from "@/lib/customer/issued-reward-display"
import { isRedeemableFrom } from "@/lib/customer/uk-date"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"

import type { RewardContext } from "./derive"
import { loadProfileGate } from "./load-profile-gate"

type RewardExperienceFlags = {
  readonly justRedeemed?: boolean
}

/**
 * Impure loader for the reward route. Resolves reward ownership + redeemability
 * and the venue location gate, then hands pure facts to
 * {@link deriveCustomerExperience}. The collected proof is driven by the
 * server-confirmed `reward_events.status`, never a query flag.
 */
export async function loadRewardExperienceContext(
  rewardId: string,
  flags: RewardExperienceFlags = {}
): Promise<RewardContext> {
  const rewardState = await getCustomerRewardState(rewardId)

  if (rewardState.status !== "ready") {
    return {
      access: rewardState.status,
      recovery:
        rewardState.status === "unauthenticated"
          ? { loginHref: customerLoginHref(`/reward/${rewardId}`) }
          : undefined,
    }
  }

  const { reward, assignedReward, loyaltyCard, merchant, membership } =
    rewardState
  const location = await getLocationRequirement(loyaltyCard.location_id)
  const expired = isRewardExpired(reward.expires_at)
  const redeemable =
    reward.status === "unlocked" &&
    !expired &&
    !rewardState.unavailableReason &&
    rewardStampThresholdMet(
      reward.source,
      membership.current_stamp_count,
      loyaltyCard.stamps_required
    ) &&
    isRedeemableFrom(reward.redeemable_from)
  // The gate only governs a ready reward — skip the profile lookup otherwise.
  const profileGate = redeemable ? await loadProfileGate() : undefined

  return {
    reward: {
      rewardId: reward.id,
      membershipId: reward.membership_id,
      rewardName: assignedReward.reward_name,
      rewardTerms: assignedReward.reward_terms,
      redeemableFrom: reward.redeemable_from,
    },
    merchantName: merchant.business_name,
    status: reward.status,
    redeemable,
    // Server-confirmed collection instant, surfaced as a quiet proof line on the
    // redeemed panel (F26). Null until the merchant scan marks it collected.
    redeemedAt: reward.redeemed_at,
    justRedeemed: flags.justRedeemed === true,
    location,
    unavailableReason: expired
      ? "This reward has expired."
      : rewardState.unavailableReason,
    profileGate,
  }
}
