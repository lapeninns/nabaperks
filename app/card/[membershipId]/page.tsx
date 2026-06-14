import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadCardExperienceContext } from "@/lib/customer/experience/load-card"

type CustomerCardPageProps = {
  params: Promise<{
    membershipId: string
  }>
  searchParams: Promise<{
    stamp?: string
    reward?: string
    geo?: string
    welcome?: string
  }>
}

export default async function CustomerCardPage({
  params,
  searchParams,
}: CustomerCardPageProps) {
  const { membershipId } = await params
  const context = await loadCardExperienceContext(membershipId, await searchParams)
  const experience = deriveCustomerExperience({ entry: "card", context })

  return <CustomerCardExperience experience={experience} />
}
