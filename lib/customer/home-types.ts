import type { CustomerActivityItem } from "@/lib/customer/activity"

export type HomeCard = {
  membershipId: string
  businessName: string
  businessSlug: string
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
