import { notFound } from "next/navigation"

import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import type { CustomerExperience } from "@/lib/customer/experience/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REFERRAL_BANK_EXPERIENCE: Extract<
  CustomerExperience,
  { kind: "card_collecting" }
> = {
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

const SETUP_REWARD_EXPERIENCE: Extract<
  CustomerExperience,
  { kind: "card_collecting" }
> = {
  ...REFERRAL_BANK_EXPERIENCE,
  current: 5,
  stampDates: ["30 Jun", "1 Jul", "Bonus", "Bonus", "2 Jul"],
  reward: "ready",
  rewardNeedsSetup: true,
  rewardId: "reward_harness_setup",
  rewardName: "A mystery reward",
  gift: {
    rewardId: "gift_harness_setup",
    rewardName: "Birthday fizz",
    source: "birthday_month",
    redeemable: true,
    needsSetup: true,
    availableFrom: null,
  },
}

/**
 * `?stamped=1` shows the card straight after a stamp: the stamp confirmation,
 * the next-stamp line and the referral panel below the progress, and no
 * contact prompt (the stamp result stands alone; setup waits for /home).
 * `?reward=setup` shows a full card whose reward and gift wait only on a setup
 * step: "Reward unlocked. Finish setting up to collect." and "Get it ready",
 * never a code to show.
 */
export default async function ReferralBankHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ stamped?: string; reward?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const experience: CustomerExperience =
    params.reward === "setup"
      ? SETUP_REWARD_EXPERIENCE
      : params.stamped === "1"
        ? {
            ...REFERRAL_BANK_EXPERIENCE,
            justStamped: true,
            slamIndex: REFERRAL_BANK_EXPERIENCE.current - 1,
            nextStampFrom: "2026-07-17T05:00:00.000Z",
          }
        : REFERRAL_BANK_EXPERIENCE

  // This harness lane exercises the referral bank, not the offers rail.
  return (
    <CustomerCardExperience
      experience={experience}
      offerPasses={[]}
      offerClaimNotice={null}
    />
  )
}
