import { notFound } from "next/navigation"

import { PageTitle, SectionHeader } from "@/components/brand"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import type { HomeCard } from "@/lib/customer/home"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * DB-free proof that the stamp-cycle rail and the issued-gift rail stay
 * separate on a home card tile (MS reward path-crossing fix): an incomplete
 * card never reads as "reward ready" just because a birthday/merchant gift is
 * waiting — the gift rides its own distinct chip. Literal fixtures only.
 */
const BASE: HomeCard = {
  membershipId: "mem_harness",
  businessName: "Old Crown Girton",
  businessSlug: "old-crown-girton",
  cardName: "Mystery Visit Card",
  rewardName: "Mystery reward",
  currentStamps: 2,
  stampsRequired: 5,
  stampDates: ["30 Jun", "1 Jul"],
  stampedToday: false,
  lastVisitAt: "2026-07-01T09:00:00.000Z",
  stampsRemaining: 3,
  unlockedRewards: 0,
  available: true,
}

const INCOMPLETE_WITH_READY_GIFT: HomeCard = {
  ...BASE,
  gift: {
    rewardId: "gift_birthday",
    rewardName: "Birthday fizz",
    source: "birthday_month",
    redeemable: true,
    redeemableFrom: "2026-07-01",
  },
}

const INCOMPLETE_WITH_WAITING_GIFT: HomeCard = {
  ...BASE,
  membershipId: "mem_harness_2",
  gift: {
    rewardId: "gift_merchant",
    rewardName: "Manager's thank-you drink",
    source: "merchant_direct",
    redeemable: false,
    redeemableFrom: "2026-12-24",
  },
}

const INCOMPLETE_WITH_REFERRAL_BANK: HomeCard = {
  ...BASE,
  membershipId: "mem_harness_referral_bank",
  currentStamps: 4,
  stampsRemaining: 1,
  stampDates: ["30 Jun", "1 Jul", "Bonus", "Bonus"],
  referralBonusBank: {
    banked: 3,
    awardedToday: 2,
  },
}

const COMPLETE_WITH_GIFT: HomeCard = {
  ...BASE,
  membershipId: "mem_harness_3",
  currentStamps: 5,
  stampsRemaining: 0,
  stampDates: ["28 Jun", "29 Jun", "30 Jun", "1 Jul", "2 Jul"],
  unlockedRewards: 1,
  stampRewardId: "reward_earned",
  gift: {
    rewardId: "gift_birthday_2",
    rewardName: "Birthday fizz",
    source: "birthday_month",
    redeemable: true,
    redeemableFrom: "2026-07-01",
  },
}

export default function GiftChipHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Harness"
        title="Card + gift rails"
        description="The stamp card and an issued gift are shown as separate rails — an incomplete card never claims 'reward ready' because a gift is waiting."
      />

      <section className="grid gap-4">
        <SectionHeader
          eyebrow="Incomplete card · ready gift"
          title="Progress stays honest; the gift rides its own chip"
        />
        <HomeCardTile card={INCOMPLETE_WITH_READY_GIFT} offerPasses={[]} />
      </section>

      <section className="grid gap-4">
        <SectionHeader
          eyebrow="Incomplete card · waiting gift"
          title="A not-yet-open gift shows a calm ready date"
        />
        <HomeCardTile card={INCOMPLETE_WITH_WAITING_GIFT} offerPasses={[]} />
      </section>

      <section className="grid gap-4">
        <SectionHeader
          eyebrow="Incomplete card · referral bank"
          title="Applied bonuses show on the grid; the rest stay banked"
        />
        <HomeCardTile card={INCOMPLETE_WITH_REFERRAL_BANK} offerPasses={[]} />
      </section>

      <section className="grid gap-4">
        <SectionHeader
          eyebrow="Completed card · plus a gift"
          title="An earned reward and a gift can sit side by side"
        />
        <HomeCardTile card={COMPLETE_WITH_GIFT} offerPasses={[]} />
      </section>
    </div>
  )
}
