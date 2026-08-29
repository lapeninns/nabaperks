import Link from "next/link"
import {
  CreditCardIcon,
  SecurityCheckIcon,
  Store01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { AdminIdChip } from "@/components/admin/id-chip"
import {
  AdminEmptyState,
  AdminPanel,
  SourceLabel,
  first,
  formatAdminAction,
  formatAdminAuditDate,
  maskAdminCustomer,
} from "@/components/admin/support"
import { MetricTile, PageTitle, SectionHeader } from "@/components/brand"
import { ActivityFeed } from "@/components/data/activity-feed"
import { FunnelChart } from "@/components/data/funnel-chart"
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

      {/* Each KPI is a link into the list it counts — clicking a number is the
          natural gesture, and it was a dead end. "Billing issues" is the only
          actionable tile, so when it is non-zero it takes the destructive wash
          instead of reading like the two vanity counts. */}
      <section className="grid gap-3 sm:grid-cols-3">
        <AdminMetricLink href="/admin/merchants" label="Merchants">
          <MetricTile
            label="Merchants"
            value={overview.merchants}
            icon={Store01Icon}
          />
        </AdminMetricLink>
        <AdminMetricLink href="/admin/customers" label="Customers">
          <MetricTile
            label="Customers"
            value={overview.customers}
            icon={UserMultiple02Icon}
          />
        </AdminMetricLink>
        <AdminMetricLink href="/admin/billing" label="Billing issues">
          <MetricTile
            label="Billing issues"
            value={overview.billingIssues}
            icon={CreditCardIcon}
            className={
              overview.billingIssues > 0 ? "bg-destructive/10" : undefined
            }
            helper={
              overview.billingIssues > 0
                ? "Needs attention: open billing states in the billing console."
                : undefined
            }
          />
        </AdminMetricLink>
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
        {/* The sanctioned 2px dashed receipt rule, not a one-off ink/20
            hairline: DESIGN.md mints exactly two dashed tones and .w-rule is
            the panel divider. */}
        <hr className="w-rule my-0" />
        <div className="grid gap-2 text-sm sm:grid-cols-2">
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
            <AdminEmptyState
              icon={SecurityCheckIcon}
              title="No audited actions yet"
              description="Audited support actions will appear here as operators work."
              padded={false}
            />
          }
        />
        <div>
          <Button asChild variant="secondary">
            <Link href="/admin/audit">View audit log</Link>
          </Button>
        </div>
      </AdminPanel>
    </div>
  )
}

/**
 * Full-tile link wrapper. `MetricTile` renders a Card, so the affordance has
 * to live on a block-level anchor around it; the accessible name is stated
 * explicitly because the tile's number would otherwise read first.
 */
function AdminMetricLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={`${label} — open`}
      className="focus-ring block rounded-lg"
    >
      {children}
    </Link>
  )
}

function toRecentAuditItem(log: AdminRecentAudit) {
  const merchant = first(log.merchants)
  const customer = first(log.customers)

  return {
    id: log.id as string,
    title: formatAdminAction(log.action as string),
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
