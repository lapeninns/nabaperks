import "server-only"

import { getCustomerRewardState } from "@/lib/customer/reward"
import { getRewardLocationRequirement } from "@/lib/customer/stamp"
import { isRedeemableFrom } from "@/lib/customer/uk-date"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"

import type { RewardContext } from "./derive"
import { loadProfileGate } from "./load-profile-gate"

type RewardSearchParams = {
  redeemed?: string
}

/**
 * Impure loader for the reward route. Resolves reward ownership + redeemability,
 * the venue location gate, and the `?redeemed=1` post-redeem proof flag, then
 * hands pure facts to {@link deriveCustomerExperience}.
 */
export async function loadRewardExperienceContext(
  rewardId: string,
  searchParams: RewardSearchParams
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
  const location = await getRewardLocationRequirement(reward.id)
  const redeemable =
    reward.status === "unlocked" &&
    !rewardState.unavailableReason &&
    membership.current_stamp_count >= loyaltyCard.stamps_required &&
    isRedeemableFrom(reward.redeemable_from)
  // The gate only governs a ready reward — skip the profile lookup otherwise.
  const profileGate = redeemable ? await loadProfileGate() : undefined

  return {
    reward: {
      rewardId: reward.id,
      membershipId: reward.membership_id,
      rewardName: assignedReward.reward_name,
      rewardTerms: assignedReward.reward_terms,
      minSpendPence: assignedReward.min_spend_pence,
      redeemableFrom: reward.redeemable_from,
    },
    merchantName: merchant.business_name,
    status: reward.status,
    redeemable,
    redeemedProof: searchParams.redeemed === "1",
    location,
    unavailableReason: rewardState.unavailableReason,
    profileGate,
  }
}
