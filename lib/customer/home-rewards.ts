import { isRedeemableFrom } from "@/lib/customer/uk-date"
import {
  pickIssuedUnlockedReward,
  pickPrimaryUnlockedReward,
} from "@/lib/customer/primary-reward"
import {
  isRewardExpired,
  narrowRewardSource,
} from "@/lib/customer/issued-reward-display"
import type {
  HomeCard,
  HomeCardGift,
  TopRedeemable,
} from "@/lib/customer/home-types"

export type RawHomeReward = {
  id: string
  membership_id: string
  reward_name: string
  redeemable_from: string | null
  expires_at?: string | null
  source?: string | null
  created_at?: string | null
}

export type RewardCounts = {
  /** Stamp-cycle unlocked reward count — the card's own pending reward(s). */
  stampUnlocked: number
  /** Exact current reward count across earned and issued rails. */
  redeemable: number
  /** Stamp-cycle redeemable reward → the tile's "Reward ready" state. */
  stampRewardId: string | null
  stampRewardName: string | null
  /** Stamp-cycle waiting (unlocked, not-yet-redeemable) reward → revealed ticket. */
  revealedRewardName: string | null
  revealedRewardRedeemableFrom: string | null
  /** Best issued reward (birthday/merchant) → a distinct gift chip. */
  gift: HomeCardGift | null
}

export function emptyRewardCounts(): RewardCounts {
  return {
    stampUnlocked: 0,
    redeemable: 0,
    stampRewardId: null,
    stampRewardName: null,
    revealedRewardName: null,
    revealedRewardRedeemableFrom: null,
    gift: null,
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
    const currentRows = membershipRows.filter(
      (row) => !isRewardExpired(row.expires_at)
    )
    entry.redeemable = currentRows.filter((row) =>
      isRedeemableFrom(row.redeemable_from)
    ).length

    // Card-completion state reflects the STAMP CYCLE only. Issued rewards are
    // split onto their own gift rail so a birthday/merchant reward never makes
    // an incomplete stamp card read as reward-ready.
    const stampRows = currentRows.filter(
      (row) => (row.source ?? "stamp_cycle") === "stamp_cycle"
    )
    entry.stampUnlocked = stampRows.length

    const stampRedeemable = pickPrimaryUnlockedReward(
      stampRows.filter((row) => isRedeemableFrom(row.redeemable_from))
    )
    if (stampRedeemable) {
      entry.stampRewardId = stampRedeemable.id
      entry.stampRewardName = stampRedeemable.reward_name
    }

    const stampWaiting = pickPrimaryUnlockedReward(
      stampRows.filter((row) => !isRedeemableFrom(row.redeemable_from))
    )
    if (stampWaiting) {
      entry.revealedRewardName = stampWaiting.reward_name
      entry.revealedRewardRedeemableFrom = stampWaiting.redeemable_from
    }

    const issued = pickIssuedUnlockedReward(currentRows)
    if (issued) {
      entry.gift = {
        rewardId: issued.id,
        rewardName: issued.reward_name,
        source: narrowRewardSource(issued.source),
        redeemable: isRedeemableFrom(issued.redeemable_from),
        redeemableFrom: issued.redeemable_from,
      }
    }

    countsByMembership.set(membershipId, entry)
  }

  return countsByMembership
}

/**
 * The single reward to feature in the home "collect now" banner — cross-source,
 * so a redeemable birthday/merchant gift nudges just like an earned reward. Walks
 * the already-sorted cards and returns the first redeemable one (stamp reward
 * first, then gift).
 */
export function getTopRedeemable(
  cards: readonly HomeCard[],
  rewardsByMembership: ReadonlyMap<string, RewardCounts>
): TopRedeemable | undefined {
  for (const card of cards) {
    const counts = rewardsByMembership.get(card.membershipId)
    if (!counts) continue

    if (counts.stampRewardId && counts.stampRewardName) {
      return {
        rewardId: counts.stampRewardId,
        rewardName: counts.stampRewardName,
        businessName: card.businessName,
        membershipId: card.membershipId,
      }
    }

    if (counts.gift?.redeemable) {
      return {
        rewardId: counts.gift.rewardId,
        rewardName: counts.gift.rewardName,
        businessName: card.businessName,
        membershipId: card.membershipId,
      }
    }
  }

  return undefined
}
