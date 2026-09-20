import "server-only"

import { getCustomerRewardState } from "@/lib/customer/reward"
import { getLocationRequirement } from "@/lib/customer/stamp"
import { isAdultDateOfBirth } from "@/lib/customer/profile-fields"
import {
  isCollectionSetupBlock,
  PHOTO_ID_REQUIRED_REASON,
  rewardCollectionBlockedCopy,
} from "@/lib/customer/reward-collection-state"
import { rewardQrAvailability } from "@/lib/customer/reward-qr-eligibility"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"

import type { RewardContext } from "./derive"
import { loadProfileGate } from "./load-profile-gate"

type RewardExperienceFlags = {
  readonly justRedeemed?: boolean
  /** `?prepare=1` — the customer chose to complete collection details early. */
  readonly prepare?: boolean
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

  const { reward, assignedReward, collection, loyaltyCard, merchant } =
    rewardState
  const location = await getLocationRequirement(loyaltyCard.location_id)
  // A profile or email block is a setup step the customer can complete here,
  // so it keeps the gate (and the recovery form) instead of the dead end. The
  // in-person photo-ID reason is a setup step only for a stated adult date of
  // birth; an under-age customer sees the age policy instead.
  const photoIdPending =
    collection.state === "blocked" &&
    collection.reason === PHOTO_ID_REQUIRED_REASON
  const earlyGate = photoIdPending ? await loadProfileGate() : undefined
  const underAge =
    photoIdPending && !isAdultDateOfBirth(earlyGate?.dateOfBirth ?? null)
  const setupBlocked =
    collection.state === "blocked" &&
    !underAge &&
    isCollectionSetupBlock(collection.reason)
  const availability = setupBlocked
    ? ({ status: "ready" } as const)
    : underAge
      ? ({
          status: "blocked",
          reason: rewardCollectionBlockedCopy(
            "Customer must be 18 or over to redeem"
          ),
        } as const)
      : rewardQrAvailability({
          collectionState: collection.state,
          collectionReason: collection.reason,
          availableFrom: collection.availableFrom,
        })
  const availableForReview = availability.status === "ready"
  // The gate governs collection, so it is read for a reward the customer can
  // collect *or* is still waiting on — the waiting screen offers the optional
  // early preparation step from exactly the same requirements. A redeemed or
  // blocked reward has nothing left to gate, so it skips the profile lookup.
  const gateApplies = availability.status !== "blocked"
  const profileGate = gateApplies
    ? (earlyGate ?? (await loadProfileGate()))
    : undefined

  return {
    reward: {
      rewardId: reward.id,
      membershipId: reward.membership_id,
      rewardName: assignedReward.reward_name,
      rewardTerms: assignedReward.reward_terms,
      redeemableFrom: reward.redeemable_from,
      availableFrom: collection.availableFrom,
      expiresAt: collection.expiresAt,
      requiresAgeCheck: collection.requiresAgeCheck,
      earningTerms: reward.earning_terms,
      inWindow: collection.inWindow,
      windowEndsAt: collection.windowEndsAt,
      upgradeRewardName: collection.upgradeRewardName,
      nextWindowStartsAt: collection.nextWindowStartsAt,
      nextWindowEndsAt: collection.nextWindowEndsAt,
      nextWindowUpgradeName: collection.nextWindowUpgradeName,
    },
    merchantName: merchant.business_name,
    status: reward.status,
    availableForReview,
    // Server-confirmed collection instant, surfaced as a quiet proof line on the
    // redeemed panel (F26). Null until the merchant scan marks it collected.
    redeemedAt: reward.redeemed_at,
    justRedeemed: flags.justRedeemed === true,
    prepare: flags.prepare === true,
    location,
    unavailableReason:
      availability.status === "blocked" ? availability.reason : undefined,
    profileGate,
  }
}
