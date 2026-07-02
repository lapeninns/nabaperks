import { logPilotNoteAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import {
  AdminField,
  AdminPanel,
  SourceLabel,
  adminSelectClasses,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { CheckmarkCircle02Icon, Store01Icon } from "@hugeicons/core-free-icons"

import {
  EmptyState,
  Icon,
  MetricTile,
  PageTitle,
  SectionHeader,
} from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminPilotMerchants, getAdminPilotReport } from "@/lib/admin/data"

export const metadata = { title: "Admin — Pilot readiness" }

export default async function AdminPilotPage() {
  if (!(await canRenderAdminPage())) return null

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
          rows={report.metrics}
          getRowKey={(metric) => metric.label}
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
                <span className="text-muted-foreground">{metric.target}</span>
              ),
            },
            {
              key: "source",
              header: "Source",
              cell: (metric) => (
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

        {merchants.length ? (
          <div className="grid gap-4">
            {merchants.map((merchant) => {
              const billing = first(merchant.billing_customers)
              return (
                <AdminRecordCard
                  key={merchant.id}
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
                  <AdminActionForm
                    action={logPilotNoteAction}
                    className="gap-3"
                  >
                    <input
                      type="hidden"
                      name="merchantId"
                      value={merchant.id}
                    />
                    <div className="grid gap-3 lg:grid-cols-[220px_160px_minmax(0,1fr)_auto]">
                      <AdminField label="Note type">
                        <select
                          name="noteType"
                          required
                          className={adminSelectClasses}
                          defaultValue="support"
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
                        <Input
                          name="setupMinutes"
                          type="number"
                          min={1}
                          max={3}
                          placeholder="1-3"
                        />
                      </AdminField>
                      <AdminField label="Notes">
                        <Textarea
                          name="notes"
                          required
                          minLength={4}
                          rows={2}
                          placeholder="What happened, source, and next action"
                        />
                      </AdminField>
                      <SubmitButton
                        pendingLabel="Saving…"
                        className="self-end"
                      >
                        <Icon icon={CheckmarkCircle02Icon} size={16} />
                        Save note
                      </SubmitButton>
                    </div>
                  </AdminActionForm>
                  }
                />
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={Store01Icon}
            title="No pilot merchants yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </AdminPanel>
    </div>
  )
}
