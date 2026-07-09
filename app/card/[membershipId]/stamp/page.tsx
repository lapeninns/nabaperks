import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadStampExperienceContext } from "@/lib/customer/experience/load-stamp"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Today's stamp",
}

type StampPageProps = {
  params: Promise<{
    membershipId: string
  }>
  searchParams: Promise<{
    qr?: string
    blocked?: string
  }>
}

export default async function StampPage({
  params,
  searchParams,
}: StampPageProps) {
  const { membershipId } = await params
  const { qr, blocked } = await searchParams
  const context = await loadStampExperienceContext(membershipId, qr, blocked)
  const experience = deriveCustomerExperience({ entry: "stamp", context })

  if (experience.kind === "reward_ready") {
    redirect(`/reward/${experience.reward.rewardId}`)
  }

  return <CustomerCardExperience experience={experience} />
}
