import { logPilotNoteAction } from "@/app/admin/actions"
import {
  EmptyState,
  MetricTile,
  PageTitle,
  SectionHeader,
} from "@/components/brand"
import { Button } from "@/components/ui/button"
import { getAdminPilotMerchants, getAdminPilotReport } from "@/lib/admin/data"

export default async function AdminPilotPage() {
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

      <section className="overflow-hidden rounded-3xl border bg-card shadow-xs">
        <div className="grid gap-1 border-b p-5">
          <SectionHeader
            title="Pilot report"
            description="Event counts come from Supabase product events. Derived rates, billing state, and interview notes are labelled separately."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-secondary text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Metric</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Pilot target</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.metrics.map((metric) => (
                <tr key={metric.label}>
                  <td className="px-4 py-3 font-bold">{metric.label}</td>
                  <td className="px-4 py-3">{metric.value}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {metric.target}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {metric.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader
          title="Pilot merchant notes"
          description="Capture support notes, cancellation reasons, payment objections, and timed staff-training proof as audited admin records."
        />

        {merchants.length ? (
          <div className="grid gap-4">
            {merchants.map((merchant) => {
              const billing = first(merchant.billing_customers)
              return (
                <article
                  key={merchant.id}
                  className="grid gap-4 rounded-2xl border bg-background p-4"
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
                      {formatDate(merchant.created_at)}
                    </p>
                  </div>

                  <form
                    action={logPilotNoteAction}
                    className="grid gap-3 lg:grid-cols-[220px_160px_minmax(0,1fr)_auto]"
                  >
                    <input
                      type="hidden"
                      name="merchantId"
                      value={merchant.id}
                    />
                    <label className="grid gap-1 text-sm font-bold">
                      Note type
                      <select
                        name="noteType"
                        className="h-10 rounded-xl border bg-background px-3 text-sm font-normal"
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
                        <option value="staff_training_timed">
                          Staff training proof
                        </option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-bold">
                      Minutes
                      <input
                        name="trainingMinutes"
                        type="number"
                        min={1}
                        max={3}
                        className="h-10 rounded-xl border bg-background px-3 text-sm font-normal"
                        placeholder="1-3"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-bold">
                      Notes
                      <textarea
                        name="notes"
                        required
                        minLength={4}
                        rows={2}
                        className="min-h-10 rounded-xl border bg-background px-3 py-2 text-sm font-normal"
                        placeholder="What happened, source, and next action"
                      />
                    </label>
                    <Button type="submit" className="self-end">
                      Save note
                    </Button>
                  </form>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No pilot merchants yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </section>
    </div>
  )
}

function first<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value)
  )
}
