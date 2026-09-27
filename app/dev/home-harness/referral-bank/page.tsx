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

/**
 * `?email=` shows the card straight after a stamp for a customer with no
 * verified email, so the compact add-your-email card sits beside the referral
 * panel (email sign-in Step 0):
 * - `missing`: no email on the profile; the card opens at the email step.
 * - `pending`: an unverified email with a code on its way; it opens at the
 *   code step, as the /home prompt does.
 */
export default async function ReferralBankHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const pending = params.email === "pending"
  const experience: CustomerExperience =
    params.email === "missing" || pending
      ? {
          ...REFERRAL_BANK_EXPERIENCE,
          justStamped: true,
          emailPrompt: {
            reason: "rewards",
            initialEmail: pending ? "alex@example.test" : null,
            codePending: pending,
          },
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
