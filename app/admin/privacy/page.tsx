import {
  logDataRequestAction,
  recordConsentOptOutAction,
} from "@/app/admin/actions"
import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  getAdminConsentRecords,
  getAdminPrivacySupportRows,
} from "@/lib/admin/data"

export default async function AdminPrivacyPage() {
  const [supportRows, consentRecords] = await Promise.all([
    getAdminPrivacySupportRows(),
    getAdminConsentRecords(),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Privacy support"
        description="Consent readback and audited support actions for privacy, export, deletion, and opt-out requests."
      />

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader
          title="Data request workflow"
          description="Verify the requester outside this console, identify the relevant customer and merchant row, log the request, then handle export, deletion, or consent follow-up manually until self-service exists."
        />
        {supportRows.length ? (
          <div className="grid gap-3">
            {supportRows.map((row) => {
              const customer = first(row.customers)
              const merchant = first(row.merchants)
              return (
                <article
                  key={row.id}
                  className="grid gap-4 rounded-2xl border p-4 xl:grid-cols-[1fr_360px_360px]"
                >
                  <div>
                    <p className="font-bold">
                      {maskContact(customer?.email ?? customer?.phone)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {merchant?.business_name ?? "Merchant"}
                    </p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      customer:{row.customer_id.slice(0, 8)} · merchant:
                      {row.merchant_id.slice(0, 8)} · membership:
                      {row.id.slice(0, 8)}
                    </p>
                  </div>
                  <form
                    action={recordConsentOptOutAction}
                    className="grid gap-2"
                  >
                    <input
                      type="hidden"
                      name="customerId"
                      value={row.customer_id}
                    />
                    <input
                      type="hidden"
                      name="merchantId"
                      value={row.merchant_id}
                    />
                    <input
                      type="hidden"
                      name="source"
                      value="support_request"
                    />
                    <input
                      type="hidden"
                      name="policyVersion"
                      value="2026-06-06"
                    />
                    <select
                      name="channel"
                      className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm"
                    >
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                    <input
                      name="reason"
                      placeholder="Opt-out reason"
                      className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
                    />
                    <Button type="submit" size="sm">
                      Record opt-out
                    </Button>
                  </form>
                  <form action={logDataRequestAction} className="grid gap-2">
                    <input
                      type="hidden"
                      name="customerId"
                      value={row.customer_id}
                    />
                    <input
                      type="hidden"
                      name="merchantId"
                      value={row.merchant_id}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        name="requestType"
                        className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm"
                      >
                        <option value="access">Access</option>
                        <option value="export">Export</option>
                        <option value="deletion">Deletion</option>
                        <option value="rectification">Rectification</option>
                        <option value="consent">Consent</option>
                      </select>
                      <select
                        name="channel"
                        className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm"
                      >
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="in_person">In person</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <input
                      name="notes"
                      placeholder="Request notes"
                      className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      Log request
                    </Button>
                  </form>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No privacy support rows yet"
            description="No customer memberships are available for privacy support yet."
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-card shadow-xs">
        <div className="border-b p-5">
          <SectionHeader
            title="Consent log"
            description="Historical opt-in and opt-out records are retained as evidence."
          />
        </div>
        {consentRecords.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-secondary text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Merchant</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Policy</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {consentRecords.map((record) => {
                  const customer = first(record.customers)
                  const merchant = first(record.merchants)
                  return (
                    <tr key={record.id}>
                      <td className="px-4 py-3">
                        {maskContact(customer?.email ?? customer?.phone)}
                      </td>
                      <td className="px-4 py-3">
                        {merchant?.business_name ?? "Merchant"}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {record.consent_status.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-3">{record.channel}</td>
                      <td className="px-4 py-3">{record.source}</td>
                      <td className="px-4 py-3">{record.policy_version}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(record.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No consent records yet"
            className="rounded-none border-0 shadow-none"
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

function maskContact(value?: string | null) {
  if (!value) return "Customer"
  if (value.includes("@")) {
    const [name, domain] = value.split("@")
    return `${name.slice(0, 2)}***@${domain}`
  }
  return `${value.slice(0, 4)}***${value.slice(-2)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
