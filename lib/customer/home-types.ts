import type { CustomerActivityItem } from "@/lib/customer/activity"

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
  unlockedRewards: number
  redeemableRewards: number
  primaryRewardId?: string
  /** Name of the waiting (unlocked, not-yet-redeemable) reward, for the wallet mini ticket. */
  revealedRewardName?: string | null
  /** UK business date the waiting reward opens — drives the mini ticket timing chip. */
  revealedRewardRedeemableFrom?: string | null
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
