import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminReferralOps } from "@/lib/admin/data"
import {
  buildLookupHref,
  parseAdminLookupParams,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

import { ReferralOpsPanel } from "./referral-ops-panel"

export const metadata = { title: "Admin — Referrals" }

type AdminReferralsPageProps = {
  searchParams?: Promise<AdminSearchParams>
}

export default async function AdminReferralsPage({
  searchParams,
}: AdminReferralsPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const lookup = parseAdminLookupParams(params)
  const referrals = await getAdminReferralOps(lookup)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Referrals"
        description="Referral records: attribution, qualification, settlement state, holds, retries, and fraud flags."
      />

      <ReferralOpsPanel
        referrals={referrals}
        lookup={lookup}
        hrefForPage={(page) =>
          buildLookupHref("/admin/referrals", { venue: lookup.venue, page })
        }
      />
    </div>
  )
}
