import { PageTitle } from "@/components/brand"
import { RewardListSections } from "@/components/customer/reward-list-cards"
import { getCustomerRewards } from "@/lib/customer/rewards"

export const metadata = {
  title: "Your rewards · Nabaperks",
}

export default async function HomeRewardsPage() {
  const { redeemable, needsSetup, upcoming, redeemed, expired } =
    await getCustomerRewards()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Rewards"
        description="Rewards from all your cards: ready to collect, on the way, and ones you've enjoyed."
      />
      <RewardListSections
        rewards={{ redeemable, needsSetup, upcoming, redeemed, expired }}
      />
    </div>
  )
}
