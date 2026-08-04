import type { Metadata } from "next"

import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadCardExperienceContext } from "@/lib/customer/experience/load-card"
import { listCustomerOfferPassesForMembership } from "@/lib/customer/offer-pass"
import { offerClaimNoticeFromParams } from "@/lib/customer/offer-pass-view"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "My loyalty card",
}

type CustomerCardPageProps = {
  params: Promise<{
    membershipId: string
  }>
  /**
   * `offer` and `membership` are the offer-claim outcomes redirected here by
   * `app/m/[merchantSlug]/join/actions.ts`; they are declared and read so the
   * customer is told what the poster they scanned actually did.
   */
  searchParams: Promise<{
    stamp?: string
    reward?: string
    geo?: string
    welcome?: string
    offer?: string
    membership?: string
  }>
}

export default async function CustomerCardPage({
  params,
  searchParams,
}: CustomerCardPageProps) {
  const { membershipId } = await params
  const query = await searchParams
  // The card and its discount passes are independent reads, so they run
  // together rather than one after the other.
  const [context, offerPasses] = await Promise.all([
    loadCardExperienceContext(membershipId, query),
    listCustomerOfferPassesForMembership(membershipId),
  ])
  const experience = deriveCustomerExperience({ entry: "card", context })

  return (
    <CustomerCardExperience
      experience={experience}
      offerPasses={offerPasses}
      offerClaimNotice={offerClaimNoticeFromParams(query)}
    />
  )
}
