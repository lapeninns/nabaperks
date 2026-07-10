import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminReferralOps } from "@/lib/admin/data"

import { ReferralOpsPanel } from "./referral-ops-panel"

export const metadata = { title: "Admin — Referrals" }

export default async function AdminReferralsPage() {
  if (!(await canRenderAdminPage())) return null

  const rows = await getAdminReferralOps()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Referrals"
        description="Referral records: attribution, qualification, settlement state, holds, retries, and fraud flags."
      />

      <ReferralOpsPanel rows={rows} />
    </div>
  )
}
