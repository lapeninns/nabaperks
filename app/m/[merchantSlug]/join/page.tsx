import { redirect } from "next/navigation"

import { JoinWizard } from "@/components/customer/join-wizard"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadJoinExperienceContext } from "@/lib/customer/experience/load-join"
import { destinationForReturningQrVisit } from "@/lib/customer/returning-qr-redirect"

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
  const resolvedSearchParams = await searchParams
  const context = await loadJoinExperienceContext(
    merchantSlug,
    resolvedSearchParams
  )

  if (
    !context.unavailable &&
    context.hasSession &&
    context.membership &&
    context.qrId
  ) {
    const destination = await destinationForReturningQrVisit(
      merchantSlug,
      context.qrId,
      { issueStamp: false }
    )
    if (destination) redirect(destination)
  }

  const experience = deriveCustomerExperience({ entry: "join", context })

  return <JoinWizard experience={experience} />
}
