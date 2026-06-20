import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import {
  AdminField,
  AdminPanel,
  SourceLabel,
  adminInputClasses,
  adminTextareaClasses,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { Icon, MetricTile, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { Button } from "@/components/ui/button"
import { ADMIN_PILOT_MERCHANTS, ADMIN_PILOT_REPORT } from "./mock-data"
import { PreviewActionForm } from "./preview-forms"

type PilotMetric = (typeof ADMIN_PILOT_REPORT.metrics)[number]

/**
 * Mirror of `/admin/pilot`. Reuses the real checklist `MetricTile`s, the metrics
 * `DataTable`, and `AdminPanel`/`SourceLabel`. The merchant pilot-note form is
 * rendered statically (disabled) since its `logPilotNoteAction` is server-only.
 */
export function AdminPilotScreen() {
  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Pilot readiness"
        description="Launch gates, source-backed funnel metrics, and merchant pilot notes."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ADMIN_PILOT_REPORT.checklist.map((item) => (
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

      <AdminPanel className="overflow-hidden p-0">
        <div className="grid gap-3 border-b p-5">
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
        </div>
        <DataTable
          caption="Pilot readiness source-labelled metrics"
          cardBreakpoint="xl"
          className="rounded-none border-0 shadow-none"
          mobileClassName="p-5"
          rows={ADMIN_PILOT_REPORT.metrics}
          getRowKey={(metric: PilotMetric) => metric.label}
          mobileCard={(metric: PilotMetric) => (
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
                {
                  label: "Source",
                  value: <SourceLabel>Source: {metric.source}</SourceLabel>,
                },
              ]}
            />
          )}
          columns={[
            {
              key: "metric",
              header: "Metric",
              cell: (metric: PilotMetric) => (
                <span className="font-bold">{metric.label}</span>
              ),
            },
            {
              key: "value",
              header: "Value",
              cell: (metric: PilotMetric) => (
                <span className="numeric-tabular">{metric.value}</span>
              ),
            },
            {
              key: "target",
              header: "Pilot target",
              cell: (metric: PilotMetric) => (
                <span className="text-muted-foreground">{metric.target}</span>
              ),
            },
            {
              key: "source",
              header: "Source",
              cell: (metric: PilotMetric) => (
                <SourceLabel>Source: {metric.source}</SourceLabel>
              ),
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel>
        <SectionHeader
          title="Pilot merchant notes"
          description="Capture support notes, cancellation reasons, payment objections, and self-service launch checks as audited admin records."
          actions={<SourceLabel>Source: audit_logs</SourceLabel>}
        />

        <div className="grid gap-4">
          {ADMIN_PILOT_MERCHANTS.map((merchant) => {
            const billing = first(merchant.billing_customers)
            return (
              <article
                key={merchant.id}
                className="grid gap-4 rounded-lg border bg-background p-4"
              >
                <div className="grid gap-1 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-bold">{merchant.business_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {merchant.email} · {merchant.status}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {billing?.status ?? "no billing record"} ·{" "}
                    {formatAdminDate(merchant.created_at)}
                  </p>
                </div>

                <PreviewActionForm className="grid gap-3 lg:grid-cols-[220px_160px_minmax(0,1fr)_auto]">
                  <AdminField label="Note type">
                    <select
                      className={adminInputClasses}
                      defaultValue="support"
                      disabled
                    >
                      <option value="support">Support note</option>
                      <option value="interview">Interview note</option>
                      <option value="payment_objection">
                        Payment objection
                      </option>
                      <option value="cancellation_reason">
                        Cancellation reason
                      </option>
                      <option value="launch_self_service_checked">
                        Self-service launch check
                      </option>
                    </select>
                  </AdminField>
                  <AdminField
                    label="Setup check minutes"
                    helper="Optional for self-service launch checks."
                  >
                    <input
                      type="number"
                      min={1}
                      max={3}
                      className={adminInputClasses}
                      placeholder="1-3"
                      disabled
                    />
                  </AdminField>
                  <AdminField label="Notes">
                    <textarea
                      rows={2}
                      className={adminTextareaClasses}
                      placeholder="What happened, source, and next action"
                      disabled
                    />
                  </AdminField>
                  <Button type="button" className="self-end" disabled>
                    <Icon icon={CheckmarkCircle02Icon} size={16} />
                    Save note
                  </Button>
                </PreviewActionForm>
              </article>
            )
          })}
        </div>
      </AdminPanel>
    </div>
  )
}
