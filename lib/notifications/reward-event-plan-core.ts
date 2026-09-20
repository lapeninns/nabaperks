import {
  isCollectionSetupBlock,
  type RewardCollectionSnapshot,
} from "@/lib/customer/reward-collection-state"

export type RewardUnlockedNotificationEvent =
  "reward_ready" | "profile_required_to_collect" | "reward_unlocked_waiting"

export function rewardUnlockedNotificationEvent(
  collection: Pick<
    RewardCollectionSnapshot,
    "state" | "reason" | "availableFrom" | "expiresAt"
  >
): RewardUnlockedNotificationEvent | null {
  if (collection.state === "ready") return "reward_ready"
  if (collection.state === "waiting") return "reward_unlocked_waiting"
  if (
    collection.state === "blocked" &&
    isCollectionSetupBlock(collection.reason)
  ) {
    return "profile_required_to_collect"
  }
  return null
}
