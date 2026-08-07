import { logPilotNoteAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import { AdminViewTabs } from "@/components/admin/view-tabs"
import {
  AdminEmptyState,
  AdminPanel,
  AdminPanelHeader,
  SourceLabel,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminRecordCard } from "@/components/admin/record-card"
import { PilotNoteFields } from "@/components/admin/pilot-note-fields"
import { Store01Icon } from "@hugeicons/core-free-icons"

import { MetricTile, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { ShowMoreList } from "@/components/data/show-more-list"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminPilotMerchants, getAdminPilotReport } from "@/lib/admin/data"
import type { AdminSearchParams } from "@/lib/admin/lookup-query"

export const metadata = { title: "Admin — Pilot readiness" }

type AdminPilotPageProps = {
  searchParams?: Promise<AdminSearchParams>
}

/**
 * Readiness and merchant notes are two reading patterns — KPI tiles + a
 * source-labelled metrics table, and a card list with an embedded write form —
 * that stacked to ~2,500px on one screen and made the operator re-learn the
 * layout twice. They are segmented views now.
 */
export default async function AdminPilotPage({
  searchParams,
}: AdminPilotPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view
  const view = rawView === "merchants" ? "merchants" : "report"

  const [report, merchants] = await Promise.all([
    getAdminPilotReport(),
    getAdminPilotMerchants(),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Pilot readiness"
        description="Launch gates, source-backed funnel metrics, and merchant pilot notes."
      />

      <AdminViewTabs
        label="Pilot views"
        activeId={view}
        tabs={[
          { id: "report", label: "Readiness", href: "/admin/pilot" },
          {
            id: "merchants",
            label: "Merchant notes",
            href: "/admin/pilot?view=merchants",
          },
        ]}
      />

      {view === "report" ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.checklist.map((item) => (
              <MetricTile
                key={item.item}
                label={item.item}
                value={item.value}
                helper={
                  <>
                    <span className="block">{item.target}</span>
                    <span className="mt-2 block font-mono">{item.source}</span>
                  </>
                }
              />
            ))}
          </section>

          <AdminPanel variant="flush" className="overflow-hidden">
            <AdminPanelHeader>
              <SectionHeader
                title="Pilot report"
                description="Event counts come from Supabase product events. Derived rates, billing state, and interview notes are labelled separately."
                actions={
                  <div className="flex flex-wrap gap-2">
                    <SourceLabel>Source: product_events</SourceLabel>
                    <SourceLabel>Source: merchants table</SourceLabel>
                    <SourceLabel>Source: billing_customers</SourceLabel>
                  </div>
                }
              />
            </AdminPanelHeader>
            <DataTable
              caption="Pilot readiness source-labelled metrics"
              cardBreakpoint="xl"
              className="rounded-none border-0 shadow-none"
              mobileClassName="p-5"
              rows={report.metrics}
              getRowKey={(metric) => metric.label}
              emptyState={
                <AdminEmptyState
                  title="No pilot metrics available yet"
                  description="Pilot metrics appear here once the report source returns data."
                />
              }
              mobileCard={(metric) => (
                <AdminRecordCard
                  title={metric.label}
                  fields={[
                    {
                      label: "Value",
                      value: (
                        <span className="numeric-tabular">{metric.value}</span>
                      ),
                    },
                    { label: "Pilot target", value: metric.target },
                    { label: "Source", mono: true, value: metric.source },
                  ]}
                />
              )}
              columns={[
                {
                  key: "metric",
                  header: "Metric",
                  cell: (metric) => (
                    <span className="font-bold">{metric.label}</span>
                  ),
                },
                {
                  key: "value",
                  header: "Value",
                  cell: (metric) => (
                    <span className="numeric-tabular">{metric.value}</span>
                  ),
                },
                {
                  key: "target",
                  header: "Pilot target",
                  cell: (metric) => (
                    <span className="text-muted-foreground">
                      {metric.target}
                    </span>
                  ),
                },
                {
                  // The constant word "Source:" no longer repeats down a whole
                  // column — the panel header states provenance once.
                  key: "source",
                  header: "Source",
                  cell: (metric) => (
                    <span className="mono-meta text-muted-foreground">
                      {metric.source}
                    </span>
                  ),
                },
              ]}
            />
          </AdminPanel>
        </>
      ) : (
        <AdminPanel>
          <SectionHeader
            title="Pilot merchant notes"
            description="Capture support notes, cancellation reasons, payment objections, and self-service launch checks as audited admin records."
            actions={<SourceLabel>Source: audit_logs</SourceLabel>}
          />

          {merchants.length ? (
            <ShowMoreList
              label="Pilot merchant notes"
              initialCount={8}
              listClassName="gap-4"
              items={merchants.map((merchant) => {
                const billing = first(merchant.billing_customers)
                return {
                  key: merchant.id,
                  content: (
                    <AdminRecordCard
                      title={merchant.business_name}
                      fields={[
                        {
                          label: "Account",
                          value: `${merchant.email} · ${merchant.status}`,
                        },
                        {
                          label: "Billing",
                          value: (
                            <>
                              {billing?.status ?? "no billing record"} ·{" "}
                              <time dateTime={merchant.created_at}>
                                {formatAdminDate(merchant.created_at)}
                              </time>
                            </>
                          ),
                        },
                      ]}
                      action={
                        <AdminRecordActions
                          label="Log a pilot note"
                          group="pilot-merchant-note"
                        >
                          <AdminActionForm
                            action={logPilotNoteAction}
                            className="gap-3"
                          >
                            <input
                              type="hidden"
                              name="merchantId"
                              value={merchant.id}
                            />
                            <PilotNoteFields />
                          </AdminActionForm>
                        </AdminRecordActions>
                      }
                    />
                  ),
                }
              })}
            />
          ) : (
            <AdminEmptyState
              icon={Store01Icon}
              title="No pilot merchants yet"
              padded={false}
            />
          )}
        </AdminPanel>
      )}
    </div>
  )
}
