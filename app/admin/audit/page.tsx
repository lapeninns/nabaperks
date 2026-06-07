import { EmptyState, PageTitle } from "@/components/brand"
import { getAdminAuditLogs } from "@/lib/admin/data"

export default async function AdminAuditPage() {
  const logs = await getAdminAuditLogs()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Audit logs"
        description="Actor, action, context, timestamp, and non-sensitive metadata."
      />

      <section className="overflow-hidden rounded-3xl border bg-card shadow-xs">
        {logs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Context</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => {
                  const merchant = first(log.merchants)
                  const customer = first(log.customers)
                  return (
                    <tr key={log.id}>
                      <td className="px-4 py-3 font-bold">{log.action}</td>
                      <td className="px-4 py-3">
                        {log.actor_type}
                        {log.actor_id ? `:${log.actor_id.slice(0, 8)}` : ""}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {merchant?.business_name ?? "No merchant"}
                        {customer ? ` · ${maskContact(customer.email ?? customer.phone)}` : ""}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {log.target_table}:{log.target_id?.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No audit logs yet"
            description="Audited support and security-sensitive actions will appear here."
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
