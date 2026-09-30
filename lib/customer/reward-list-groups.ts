import {
  rewardCollectability,
  type RewardCollectionState,
} from "@/lib/customer/reward-collection-state"

/**
 * The Rewards tab groups rewards by what the guest can do with them, not by
 * the database status:
 *
 * - `redeemable` ("Ready to collect"): the code can be shown now, including a
 *   reward whose only remaining check is photo ID at the counter.
 * - `needsSetup` ("Needs setting up"): unlocked, waiting on a detail from the
 *   guest. It links to the reward page, which asks for the next missing one.
 * - `upcoming` ("On the way"): waiting for its opening time, or held by the
 *   venue (paused, one reward per visit), with the server's reason as a note.
 * - `redeemed` ("Collected") and `expired` ("No longer available").
 *
 * Pure presentation grouping. Collection itself stays with the QR route and
 * the database predicate.
 */
export type RewardListGroup =
  "redeemable" | "needsSetup" | "upcoming" | "redeemed" | "expired"

export function rewardListGroup(
  state: RewardCollectionState,
  reason: string | null
): RewardListGroup {
  if (state === "redeemed") return "redeemed"
  if (state === "expired" || state === "cancelled") return "expired"
  const collectability = rewardCollectability(state, reason)
  if (collectability === "ready") return "redeemable"
  if (collectability === "needs_setup") return "needsSetup"
  return "upcoming"
}

export type GroupedRewards<T> = Record<RewardListGroup, T[]>

export function groupRewardsForList<
  T extends {
    collectionState: RewardCollectionState
    collectionReason: string | null
  },
>(items: readonly T[]): GroupedRewards<T> {
  const groups: GroupedRewards<T> = {
    redeemable: [],
    needsSetup: [],
    upcoming: [],
    redeemed: [],
    expired: [],
  }
  for (const item of items) {
    groups[rewardListGroup(item.collectionState, item.collectionReason)].push(
      item
    )
  }
  return groups
}
