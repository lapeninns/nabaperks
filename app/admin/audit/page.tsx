import {
  AdminPanel,
  SourceLabel,
  first,
  formatAdminDate,
  maskAdminContact,
} from "@/components/admin/support"
import { SecurityCheckIcon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
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

      <AdminPanel className="p-0">
        <div className="border-b p-5">
          <SourceLabel>Source: audit_logs</SourceLabel>
        </div>
        <DataTable
          caption="Admin audit log readback"
          className="rounded-none border-0 shadow-none"
          rows={logs}
          getRowKey={(log) => log.id}
          emptyState={
            <EmptyState
              icon={SecurityCheckIcon}
              title="No audit logs yet"
              description="Audited support and security-sensitive actions will appear here."
              className="rounded-none border-0 shadow-none"
            />
          }
          columns={[
            {
              key: "action",
              header: "Action",
              cell: (log) => <span className="font-bold">{log.action}</span>,
            },
            {
              key: "actor",
              header: "Actor",
              cell: (log) => (
                <span>
                  {log.actor_type}
                  {log.actor_id ? `:${log.actor_id.slice(0, 8)}` : ""}
                </span>
              ),
            },
            {
              key: "context",
              header: "Context",
              cell: (log) => {
                const merchant = first(log.merchants)
                const customer = first(log.customers)
                return (
                  <span className="text-muted-foreground">
                    {merchant?.business_name ?? "No merchant"}
                    {customer
                      ? ` · ${maskAdminContact(customer.email ?? customer.phone)}`
                      : ""}
                  </span>
                )
              },
            },
            {
              key: "target",
              header: "Target",
              cell: (log) => (
                <span className="font-mono text-xs">
                  {log.target_table}:{log.target_id?.slice(0, 8)}
                </span>
              ),
            },
            {
              key: "when",
              header: "When",
              cell: (log) => (
                <time className="text-muted-foreground" dateTime={log.created_at}>
                  {formatAdminDate(log.created_at)}
                </time>
              ),
            },
          ]}
        />
      </AdminPanel>
    </div>
  )
}
