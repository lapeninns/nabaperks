import { redirect } from "next/navigation"

import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadStampExperienceContext } from "@/lib/customer/experience/load-stamp"

export const dynamic = "force-dynamic"

type StampPageProps = {
  params: Promise<{
    membershipId: string
  }>
  searchParams: Promise<{
    qr?: string
  }>
}

export default async function StampPage({
  params,
  searchParams,
}: StampPageProps) {
  const { membershipId } = await params
  const { qr } = await searchParams
  const context = await loadStampExperienceContext(membershipId, qr)
  const experience = deriveCustomerExperience({ entry: "stamp", context })

  // A ready, redeemable reward blocks new stamps — route straight to redeem
  // instead of rendering the stamp screen for a reward that can be claimed now.
  if (experience.kind === "reward_ready") {
    redirect(`/reward/${experience.reward.rewardId}`)
  }

  return <CustomerCardExperience experience={experience} />
}
