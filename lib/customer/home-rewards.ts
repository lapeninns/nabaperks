import { isRedeemableFrom } from "@/lib/customer/uk-date"
import { pickPrimaryUnlockedReward } from "@/lib/customer/primary-reward"
import type { HomeCard, TopRedeemable } from "@/lib/customer/home-types"

export type RawHomeReward = {
  id: string
  membership_id: string
  reward_name: string
  redeemable_from: string | null
  source?: string | null
  created_at?: string | null
}

export type RewardCounts = {
  total: number
  redeemable: number
  primaryRewardId: string | null
  primaryRewardName: string | null
  revealedRewardName: string | null
  revealedRewardRedeemableFrom: string | null
}

export function emptyRewardCounts(): RewardCounts {
  return {
    total: 0,
    redeemable: 0,
    primaryRewardId: null,
    primaryRewardName: null,
    revealedRewardName: null,
    revealedRewardRedeemableFrom: null,
  }
}

export function buildRewardCountsByMembership(
  rows: readonly RawHomeReward[]
): Map<string, RewardCounts> {
  const rewardsByMembership = new Map<string, RawHomeReward[]>()

  for (const row of rows) {
    const entry = rewardsByMembership.get(row.membership_id) ?? []
    entry.push(row)
    rewardsByMembership.set(row.membership_id, entry)
  }

  const countsByMembership = new Map<string, RewardCounts>()

  for (const [membershipId, membershipRows] of rewardsByMembership) {
    const entry = emptyRewardCounts()
    entry.total = membershipRows.length
    entry.redeemable = membershipRows.filter((row) =>
      isRedeemableFrom(row.redeemable_from)
    ).length

    const primary = pickPrimaryUnlockedReward(membershipRows)
    if (primary && isRedeemableFrom(primary.redeemable_from)) {
      entry.primaryRewardId = primary.id
      entry.primaryRewardName = primary.reward_name
    }

    const waiting = pickPrimaryUnlockedReward(
      membershipRows.filter((row) => !isRedeemableFrom(row.redeemable_from))
    )
    if (waiting) {
      entry.revealedRewardName = waiting.reward_name
      entry.revealedRewardRedeemableFrom = waiting.redeemable_from
    }

    countsByMembership.set(membershipId, entry)
  }

  return countsByMembership
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
