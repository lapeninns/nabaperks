import { JoinWizard } from "@/components/customer/join-wizard"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadJoinExperienceContext } from "@/lib/customer/experience/load-join"

type MerchantJoinPageProps = {
  params: Promise<{
    merchantSlug: string
  }>
  searchParams: Promise<{
    qr?: string
    step?: string
    membership?: string
  }>
}

export default async function MerchantJoinPage({
  params,
  searchParams,
}: MerchantJoinPageProps) {
  const { merchantSlug } = await params
  const context = await loadJoinExperienceContext(merchantSlug, await searchParams)
  const experience = deriveCustomerExperience({ entry: "join", context })

  return <JoinWizard experience={experience} />
}
