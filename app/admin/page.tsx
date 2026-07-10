import Link from "next/link"
import {
  CreditCardIcon,
  SecurityCheckIcon,
  Store01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { AdminIdChip } from "@/components/admin/id-chip"
import {
  AdminPanel,
  SourceLabel,
  first,
  formatAdminAuditDate,
  maskAdminCustomer,
} from "@/components/admin/support"
import {
  EmptyState,
  Icon,
  MetricTile,
  PageTitle,
  SectionHeader,
} from "@/components/brand"
import { ActivityFeed } from "@/components/data/activity-feed"
import { FunnelChart } from "@/components/data/funnel-chart"
import { adminNavItems } from "@/components/layout/console-nav"
import { Button } from "@/components/ui/button"
import {
  formatFirstStampSevenDayOutcome,
  formatMedianSignupToPoster,
  toMerchantActivationFunnelItems,
} from "@/lib/analytics/merchant-activation-contract"
import { getMerchantActivationCohortFacts } from "@/lib/analytics/funnels"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminOverview } from "@/lib/admin/data"

// Distinguishes console tabs; the root title template appends "| Nabaperks".
export const metadata = { title: "Admin console" }

type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>
type AdminRecentAudit = AdminOverview["recentAudits"][number]

export default async function AdminHomePage() {
  if (!(await canRenderAdminPage())) return null

  const [overview, activationFacts] = await Promise.all([
    getAdminOverview(),
    getMerchantActivationCohortFacts(),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
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
          title="Merchant activation funnel"
          description="A 30-day account-created cohort for accounts created in the last 30 days, derived from authoritative merchant, setup, billing, and stamp ledgers."
          actions={<SourceLabel>Source: aggregate ledgers</SourceLabel>}
        />
        <FunnelChart
          aria-label="Merchant activation funnel"
          items={toMerchantActivationFunnelItems(activationFacts)}
        />
        <div className="grid gap-2 border-t border-ink/20 pt-4 text-sm sm:grid-cols-2">
          <p>
            <span className="font-bold">Median account to poster:</span>{" "}
            <span className="numeric-tabular text-muted-foreground">
              {formatMedianSignupToPoster(
                activationFacts.median_signup_to_poster_seconds
              )}
            </span>
          </p>
          <p>
            <span className="font-bold">First stamp within 7 days:</span>{" "}
            <span className="numeric-tabular text-muted-foreground">
              {formatFirstStampSevenDayOutcome(activationFacts)}
            </span>
          </p>
        </div>
      </AdminPanel>

      <AdminPanel>
        <SectionHeader
          title="Recent audited actions"
          description="The last six entries from the audit trail; times in UK local time."
          actions={<SourceLabel>Source: audit_logs</SourceLabel>}
        />
        <ActivityFeed
          aria-label="Recent audited actions"
          items={overview.recentAudits.map((log: AdminRecentAudit) =>
            toRecentAuditItem(log)
          )}
          emptyState={
            <EmptyState
              icon={SecurityCheckIcon}
              title="No audited actions yet"
              description="Audited support actions will appear here as operators work."
              className="rounded-none border-0 p-0 shadow-none"
            />
          }
        />
        <div>
          <Button asChild variant="secondary">
            <Link href="/admin/audit">View audit log</Link>
          </Button>
        </div>
      </AdminPanel>

      {/* 8 nav links: 2-col from sm, 4-col from lg — grid-cols-7 compressed
          each cell below the whitespace-nowrap label width at 1024-1280. */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

function toRecentAuditItem(log: AdminRecentAudit) {
  const merchant = first(log.merchants)
  const customer = first(log.customers)

  return {
    id: log.id as string,
    title: log.action as string,
    description: (
      <>
        {merchant?.business_name ?? "No merchant"}
        {customer ? ` · ${maskAdminCustomer(customer)}` : ""}
      </>
    ),
    metadata: (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {log.target_id ? (
          <AdminIdChip value={log.target_id} prefix={log.target_table} />
        ) : (
          <span className="font-mono">{log.target_table}</span>
        )}
        <time dateTime={log.created_at}>
          {formatAdminAuditDate(log.created_at)}
        </time>
      </span>
    ),
  }
}
