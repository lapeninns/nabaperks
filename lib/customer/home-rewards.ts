import { isRedeemableFrom } from "@/lib/customer/uk-date"
import type { HomeCard, TopRedeemable } from "@/lib/customer/home-types"

export type RawHomeReward = {
  id: string
  membership_id: string
  reward_name: string
  redeemable_from: string | null
}

export type RewardCounts = {
  total: number
  redeemable: number
  primaryRewardId: string | null
  primaryRewardName: string | null
}

export function emptyRewardCounts(): RewardCounts {
  return {
    total: 0,
    redeemable: 0,
    primaryRewardId: null,
    primaryRewardName: null,
  }
}

export function buildRewardCountsByMembership(
  rows: readonly RawHomeReward[]
): Map<string, RewardCounts> {
  const rewardsByMembership = new Map<string, RewardCounts>()

  for (const row of rows) {
    const entry =
      rewardsByMembership.get(row.membership_id) ?? emptyRewardCounts()
    entry.total += 1
    if (isRedeemableFrom(row.redeemable_from)) {
      entry.redeemable += 1
      if (!entry.primaryRewardId) {
        entry.primaryRewardId = row.id
        entry.primaryRewardName = row.reward_name
      }
    }
    rewardsByMembership.set(row.membership_id, entry)
  }

  return rewardsByMembership
}

export function getTopRedeemable(
  cards: readonly HomeCard[],
  rewardsByMembership: ReadonlyMap<string, RewardCounts>
): TopRedeemable | undefined {
  const topReward = cards.find(hasPrimaryReward)
  const topRewardCounts = topReward
    ? rewardsByMembership.get(topReward.membershipId)
    : undefined

  if (!topReward || !topRewardCounts?.primaryRewardName) return undefined

  return {
    rewardId: topReward.primaryRewardId,
    rewardName: topRewardCounts.primaryRewardName,
    businessName: topReward.businessName,
    membershipId: topReward.membershipId,
  }
}

function hasPrimaryReward(card: HomeCard): card is HomeCard & {
  primaryRewardId: string
} {
  return Boolean(card.primaryRewardId)
}
