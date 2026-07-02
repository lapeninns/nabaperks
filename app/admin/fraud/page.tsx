import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminFraudSignals } from "@/lib/admin/data"

import { FraudFlagsPanel } from "./fraud-flags-panel"
import { RedemptionFailuresPanel } from "./redemption-failures-panel"

export const metadata = { title: "Admin — Fraud" }

export default async function AdminFraudPage() {
  if (!(await canRenderAdminPage())) return null

  const fraud = await getAdminFraudSignals()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Fraud"
        description="Fraud flags, soft geofence anomalies, and security-related product events."
      />

      <FraudFlagsPanel flags={fraud.fraudFlags} />
      <RedemptionFailuresPanel failures={fraud.failures} />
    </div>
  )
}
