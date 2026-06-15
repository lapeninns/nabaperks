import Link from "next/link"
import {
  CreditCardIcon,
  Store01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { AdminPanel, SourceLabel } from "@/components/admin/support"
import { Icon, MetricTile, PageTitle, SectionHeader } from "@/components/brand"
import { FunnelChart } from "@/components/data/funnel-chart"
import { adminNavItems } from "@/components/layout/admin-shell"
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
        <MetricTile
          label="Merchants"
          value={overview.merchants}
          icon={Store01Icon}
        />
        <MetricTile
          label="Customers"
          value={overview.customers}
          icon={UserMultiple02Icon}
        />
        <MetricTile
          label="Billing issues"
          value={overview.billingIssues}
          icon={CreditCardIcon}
        />
      </section>

      <AdminPanel>
        <SectionHeader
          title="Pilot funnel readback"
          description="Source-of-truth event counts from Supabase product events."
          actions={<SourceLabel>Source: product_events</SourceLabel>}
        />
        <FunnelChart
          items={Object.entries(funnelCounts).map(([label, value]) => ({
            label,
            value,
          }))}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(funnelCounts).map(([eventName, count]) => (
            <MetricTile key={eventName} label={eventName} value={count} />
          ))}
        </div>
      </AdminPanel>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {adminNavItems.map((item) => (
          <Button key={item.href} asChild variant="secondary">
            <Link href={item.href}>
              {item.icon ? <Icon icon={item.icon} size={16} /> : null}
              {item.label}
            </Link>
          </Button>
        ))}
      </section>
    </div>
  )
}
