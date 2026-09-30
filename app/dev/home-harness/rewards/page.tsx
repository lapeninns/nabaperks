import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { RewardListSections } from "@/components/customer/reward-list-cards"

import { HOME_HARNESS_REWARDS } from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Rewards tab harness: the real grouped sections fed by static fixtures, so
 * every group (ready to collect, needs setting up, on the way, collected, no
 * longer available) and the issued-reward badges render with no auth or DB.
 * `?empty=1` shows the empty state.
 */
export default async function HomeHarnessRewardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ empty?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const rewards =
    params.empty === "1"
      ? {
          redeemable: [],
          needsSetup: [],
          upcoming: [],
          redeemed: [],
          expired: [],
        }
      : HOME_HARNESS_REWARDS

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Rewards"
        description="Rewards from all your cards: ready to collect, on the way, and ones you've enjoyed."
      />
      <RewardListSections rewards={rewards} />
    </div>
  )
}
