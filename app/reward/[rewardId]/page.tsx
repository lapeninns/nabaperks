import type { Metadata } from "next"

import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadRewardExperienceContext } from "@/lib/customer/experience/load-reward"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "My reward",
}

type RewardPageProps = {
  params: Promise<{
    rewardId: string
  }>
  searchParams: Promise<{
    reward?: string | string[]
  }>
}

export default async function RewardPage({
  params,
  searchParams,
}: RewardPageProps) {
  const { rewardId } = await params
  const query = await searchParams
  const context = await loadRewardExperienceContext(rewardId, {
    justRedeemed: firstParam(query.reward) === "redeemed",
  })
  const experience = deriveCustomerExperience({ entry: "reward", context })

  // The reward entry never derives `card_collecting` (see `deriveReward`), so
  // the discount-pass rail cannot render here. It should not: this screen has
  // one job — present the QR for this reward — and a second scannable
  // destination beside it invites the wrong code being shown at the counter.
  // The empty rail is passed explicitly so the decision is visible.
  return (
    <CustomerCardExperience
      experience={experience}
      offerPasses={[]}
      offerClaimNotice={null}
    />
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
