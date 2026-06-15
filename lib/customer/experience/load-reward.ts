import "server-only"

import { createRedemptionToken } from "@/lib/customer/redemption-token"
import { getCustomerRewardState } from "@/lib/customer/reward"
import { getRewardLocationRequirement } from "@/lib/customer/stamp"
import { isRedeemableFrom } from "@/lib/customer/uk-date"
import { getServerEnv } from "@/lib/env/server"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"

import type { RewardContext } from "./derive"

/**
 * Impure loader for the reward route. Resolves reward ownership + redeemability,
 * the venue location gate, and the merchant-scan redemption token, then hands
 * pure facts to {@link deriveCustomerExperience}.
 */
export async function loadRewardExperienceContext(
  rewardId: string
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
  const redemptionToken = redeemable
    ? await createRedemptionToken(reward.id)
    : null

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
    redeemedProof: false,
    redemptionToken: redemptionToken
      ? tokenView(reward.id, redemptionToken)
      : null,
    location,
    unavailableReason: rewardState.unavailableReason,
  }
}

function tokenView(
  rewardId: string,
  redemptionToken: { publicToken: string; expiresAt: string }
) {
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")

  return {
    publicToken: redemptionToken.publicToken,
    expiresAt: redemptionToken.expiresAt,
    redeemUrl: `${appUrl}/r/${redemptionToken.publicToken}`,
    qrImageUrl: `/reward/${rewardId}/qr`,
  }
}
