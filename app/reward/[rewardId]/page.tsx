import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadRewardExperienceContext } from "@/lib/customer/experience/load-reward"

export const dynamic = "force-dynamic"

type RewardPageProps = {
  params: Promise<{
    rewardId: string
  }>
  searchParams: Promise<{
    redeemed?: string
  }>
}

export default async function RewardPage({
  params,
  searchParams,
}: RewardPageProps) {
  const { rewardId } = await params
  const context = await loadRewardExperienceContext(rewardId, await searchParams)
  const experience = deriveCustomerExperience({ entry: "reward", context })

  return <CustomerCardExperience experience={experience} />
}
