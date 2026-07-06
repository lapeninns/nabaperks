import type { CustomerActivityItem } from "@/lib/customer/activity"
import type { RewardSource } from "@/lib/customer/issued-reward-display"

/**
 * An issued reward (birthday / merchant direct) shown as a distinct gift beside
 * a card tile — never the stamp cycle's completion reward.
 */
export type HomeCardGift = {
  rewardId: string
  rewardName: string
  source: RewardSource
  redeemable: boolean
  redeemableFrom: string | null
}

export type HomeCard = {
  membershipId: string
  businessName: string
  businessSlug: string
  /** Shareable "Bring a Regular" join link (opaque referral_code), if shareable. */
  referralShareUrl?: string
  cardName: string | null
  rewardName: string | null
  currentStamps: number
  stampsRequired: number | null
  stampDates: string[]
  stampedToday: boolean
  lastVisitAt: string | null
  stampsRemaining: number
  /** Stamp-cycle unlocked reward count — the card's own pending reward(s). */
  unlockedRewards: number
  /** Stamp-cycle redeemable reward → the tile's "Reward ready" state and QR link. */
  stampRewardId?: string
  /** Name of the waiting (unlocked, not-yet-redeemable) stamp-cycle reward, for the mini ticket. */
  revealedRewardName?: string | null
  /** UK business date the waiting reward opens — drives the mini ticket timing chip. */
  revealedRewardRedeemableFrom?: string | null
  /** Issued reward (birthday/merchant) shown as a distinct gift chip on the tile. */
  gift?: HomeCardGift | null
  available: boolean
  unavailableReason?: string
}

export type CustomerHome = {
  cards: HomeCard[]
}

export type HomeSummary = {
  cardCount: number
  redeemableCount: number
  stampAvailableCount: number
}

export type TopRedeemable = {
  rewardId: string
  rewardName: string
  businessName: string
  membershipId: string
}

export type HomeDashboard = {
  cards: HomeCard[]
  summary: HomeSummary
  topRedeemable?: TopRedeemable
  recentActivity: CustomerActivityItem[]
}
