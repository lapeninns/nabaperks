import type { CustomerActivityItem } from "@/lib/customer/activity"
import type { ReferralBonusBank } from "@/lib/customer/referral-bonus-bank"
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
  /** Redeemable only once the guest finishes setup: never shown as ready. */
  needsSetup?: boolean
  availableFrom: string | null
}

export type HomeCard = {
  membershipId: string
  policyCutoverNoticeAt?: string | null
  businessName: string
  businessSlug: string
  locality?: string | null
  googleReviewUrl?: string | null
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
  referralBonusBank?: ReferralBonusBank
  /** Stamp-cycle actionable reward: the tile links to it. */
  stampRewardId?: string
  stampRewardName?: string | null
  /**
   * That reward is unlocked but needs a detail from the guest first, so the
   * tile says "Finish setting up to collect", never "Ready".
   */
  stampRewardNeedsSetup?: boolean
  /** Name of the waiting (unlocked, not-yet-redeemable) stamp-cycle reward, for the mini ticket. */
  revealedRewardName?: string | null
  /** UK business date the waiting reward opens — drives the mini ticket timing chip. */
  revealedRewardAvailableFrom?: string | null
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
  /** Cards with a reward the guest can collect now. */
  redeemableCount: number
  /** Cards with an unlocked reward that needs setting up first. */
  setupRewardCount?: number
  stampAvailableCount: number
}

export type TopRedeemable = {
  rewardId: string
  rewardName: string
  businessName: string
  membershipId: string
  /** Unlocked but blocked by setup: "Get it ready", never a code. */
  needsSetup?: boolean
}

export type HomeDashboard = {
  cards: HomeCard[]
  summary: HomeSummary
  topRedeemable?: TopRedeemable
  recentActivity: CustomerActivityItem[]
}
