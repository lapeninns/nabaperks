import {
  cardRewardCollectable,
  resolveAgeCheckReason,
  rewardCollectability,
  type RewardCollectionState,
} from "@/lib/customer/reward-collection-state"
import {
  pickIssuedUnlockedReward,
  pickPrimaryUnlockedReward,
} from "@/lib/customer/primary-reward"
import { narrowRewardSource } from "@/lib/customer/issued-reward-display"
import type {
  HomeCard,
  HomeCardGift,
  TopRedeemable,
} from "@/lib/customer/home-types"

export type RawHomeReward = {
  id: string
  membership_id: string
  reward_name: string
  collection_state: RewardCollectionState
  /** Predicate reason; a profile or verified-email block keeps the reward actionable. */
  collection_reason?: string | null
  available_from: string | null
  source?: string | null
  created_at?: string | null
}

export type RewardCounts = {
  /** Stamp-cycle unlocked reward count — the card's own pending reward(s). */
  stampUnlocked: number
  /** Stamp-cycle actionable reward: ready, or held only by a setup step. */
  stampRewardId: string | null
  stampRewardName: string | null
  /**
   * The actionable stamp reward still needs a detail from the guest before it
   * can be collected, so it must never be shown as ready or with a code.
   */
  stampRewardNeedsSetup: boolean
  /** Stamp-cycle waiting (unlocked, not-yet-redeemable) reward → revealed ticket. */
  revealedRewardName: string | null
  revealedRewardAvailableFrom: string | null
  /** Best issued reward (birthday/merchant) → a distinct gift chip. */
  gift: HomeCardGift | null
}

export function emptyRewardCounts(): RewardCounts {
  return {
    stampUnlocked: 0,
    stampRewardId: null,
    stampRewardName: null,
    stampRewardNeedsSetup: false,
    revealedRewardName: null,
    revealedRewardAvailableFrom: null,
    gift: null,
  }
}

export function buildRewardCountsByMembership(
  rawRows: readonly RawHomeReward[],
  facts: { statedDateOfBirthIsAdult: boolean }
): Map<string, RewardCounts> {
  const rewardsByMembership = new Map<string, RawHomeReward[]>()
  // The photo-ID reason is ambiguous until the stated date of birth resolves
  // it: an under-age customer's reward is never actionable or ready here.
  const rows = rawRows.map((row) => ({
    ...row,
    collection_reason: resolveAgeCheckReason(
      row.collection_reason ?? null,
      facts.statedDateOfBirthIsAdult
    ),
  }))

  for (const row of rows) {
    const entry = rewardsByMembership.get(row.membership_id) ?? []
    entry.push(row)
    rewardsByMembership.set(row.membership_id, entry)
  }

  const countsByMembership = new Map<string, RewardCounts>()

  for (const [membershipId, membershipRows] of rewardsByMembership) {
    const entry = emptyRewardCounts()

    // Card-completion state reflects the STAMP CYCLE only. Issued rewards are
    // split onto their own gift rail so a birthday/merchant reward never makes
    // an incomplete stamp card read as reward-ready.
    const stampRows = membershipRows.filter(
      (row) => (row.source ?? "stamp_cycle") === "stamp_cycle"
    )
    entry.stampUnlocked = stampRows.length

    // A reward held only by a setup step (profile, verified email or phone) is
    // still the customer's next action, so it keeps its reward link, but it is
    // flagged so no surface calls it ready or offers a code.
    const actionable = (row: RawHomeReward) =>
      cardRewardCollectable(row.collection_state, row.collection_reason ?? null)
    const needsSetup = (row: RawHomeReward) =>
      rewardCollectability(
        row.collection_state,
        row.collection_reason ?? null
      ) === "needs_setup"
    const stampRedeemable = pickPrimaryUnlockedReward(
      stampRows.filter(actionable)
    )
    if (stampRedeemable) {
      entry.stampRewardId = stampRedeemable.id
      entry.stampRewardName = stampRedeemable.reward_name
      entry.stampRewardNeedsSetup = needsSetup(stampRedeemable)
    }

    const stampWaiting = pickPrimaryUnlockedReward(
      stampRows.filter((row) => row.collection_state === "waiting")
    )
    if (stampWaiting) {
      entry.revealedRewardName = stampWaiting.reward_name
      entry.revealedRewardAvailableFrom = stampWaiting.available_from
    }

    const issued = pickIssuedUnlockedReward(membershipRows)
    if (issued) {
      entry.gift = {
        rewardId: issued.id,
        rewardName: issued.reward_name,
        source: narrowRewardSource(issued.source),
        redeemable: actionable(issued),
        needsSetup: needsSetup(issued),
        availableFrom: issued.available_from,
      }
    }

    countsByMembership.set(membershipId, entry)
  }

  return countsByMembership
}

/**
 * The single reward to feature in the home banner, cross-source, so a
 * redeemable birthday/merchant gift nudges just like an earned reward. A reward
 * the guest can collect now outranks one that still needs setting up; within
 * each, the already-sorted card order decides (stamp reward first, then gift).
 */
export function getTopRedeemable(
  cards: readonly HomeCard[],
  rewardsByMembership: ReadonlyMap<string, RewardCounts>
): TopRedeemable | undefined {
  const candidates: TopRedeemable[] = []
  for (const card of cards) {
    const counts = rewardsByMembership.get(card.membershipId)
    if (!counts) continue

    if (counts.stampRewardId && counts.stampRewardName) {
      candidates.push({
        rewardId: counts.stampRewardId,
        rewardName: counts.stampRewardName,
        businessName: card.businessName,
        membershipId: card.membershipId,
        needsSetup: counts.stampRewardNeedsSetup,
      })
    }

    if (counts.gift?.redeemable) {
      candidates.push({
        rewardId: counts.gift.rewardId,
        rewardName: counts.gift.rewardName,
        businessName: card.businessName,
        membershipId: card.membershipId,
        needsSetup: counts.gift.needsSetup,
      })
    }
  }

  return candidates.find((candidate) => !candidate.needsSetup) ?? candidates[0]
}
