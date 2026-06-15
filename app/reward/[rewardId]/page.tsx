import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadRewardExperienceContext } from "@/lib/customer/experience/load-reward"

export const dynamic = "force-dynamic"

type RewardPageProps = {
  params: Promise<{
    rewardId: string
  }>
}

export default async function RewardPage({ params }: RewardPageProps) {
  const { rewardId } = await params
  const context = await loadRewardExperienceContext(rewardId)
  const experience = deriveCustomerExperience({ entry: "reward", context })

  return <CustomerCardExperience experience={experience} />
}
