import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { JoinWizard } from "@/components/customer/join-wizard"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadJoinExperienceContext } from "@/lib/customer/experience/load-join"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

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
    redirect(
      `/card/${context.membership.id}/stamp?qr=${encodeURIComponent(context.qrId)}`
    )
  }

  const experience = deriveCustomerExperience({ entry: "join", context })

  return <JoinWizard experience={experience} />
}
