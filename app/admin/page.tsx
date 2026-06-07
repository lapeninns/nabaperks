import Link from "next/link"

import { MetricTile, PageTitle, SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { getPilotFunnelCounts } from "@/lib/analytics/funnels"
import { getAdminOverview } from "@/lib/admin/data"

export default async function AdminHomePage() {
  const [overview, funnelCounts] = await Promise.all([
    getAdminOverview(),
    getPilotFunnelCounts(),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal support"
        title="Admin console"
        description="Restricted support views and audited manual actions."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Merchants" value={overview.merchants} />
        <MetricTile label="Customers" value={overview.customers} />
        <MetricTile label="Billing issues" value={overview.billingIssues} />
      </section>

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader
          title="Pilot funnel readback"
          description="Source-of-truth event counts from Supabase product events."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(funnelCounts).map(([eventName, count]) => (
            <MetricTile key={eventName} label={eventName} value={count} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["/admin/pilot", "Pilot"],
          ["/admin/merchants", "Merchants"],
          ["/admin/customers", "Customers"],
          ["/admin/billing", "Billing"],
          ["/admin/privacy", "Privacy"],
          ["/admin/fraud", "Fraud"],
          ["/admin/audit", "Audit"],
        ].map(([href, label]) => (
          <Button key={href} asChild variant="secondary">
            <Link href={href}>{label}</Link>
          </Button>
        ))}
      </section>
    </div>
  )
}
