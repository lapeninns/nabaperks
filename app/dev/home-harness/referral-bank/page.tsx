import { notFound } from "next/navigation"

import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import type { CustomerExperience } from "@/lib/customer/experience/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REFERRAL_BANK_EXPERIENCE: CustomerExperience = {
  kind: "card_collecting",
  membershipId: "mem_harness_referral_bank",
  merchantName: "Old Crown Girton",
  cardName: "Mystery Visit Card",
  current: 4,
  total: 5,
  slamIndex: -1,
  reward: "none",
  rewardTerms: "Mystery reward on completion.",
  rewardRedeemableFrom: null,
  gift: null,
  stampDates: ["30 Jun", "1 Jul", "Bonus", "Bonus"],
  justStamped: false,
  justJoined: false,
  firstStampRecovery: null,
  geoFlagged: false,
  justRedeemed: false,
  referralShareUrl: "http://localhost:3000/join?ref=NPDEMO",
  referralBonusBank: {
    banked: 3,
    awardedToday: 2,
  },
}

export default function ReferralBankHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return <CustomerCardExperience experience={REFERRAL_BANK_EXPERIENCE} />
}
