import {
  AdminPanel,
  SourceLabel,
  first,
  formatAdminAuditDate,
  maskAdminContact,
} from "@/components/admin/support"
import { SecurityCheckIcon } from "@hugeicons/core-free-icons"

import { AdminIdChip } from "@/components/admin/id-chip"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, PageTitle } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminAuditLogs } from "@/lib/admin/data"

type AdminAuditLogs = Awaited<ReturnType<typeof getAdminAuditLogs>>
type AdminAuditLog = AdminAuditLogs[number]

export const metadata = { title: "Admin — Audit logs" }

export default async function AdminAuditPage() {
  if (!(await canRenderAdminPage())) return null

  const logs = await getAdminAuditLogs()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Audit logs"
        description="Actor, action, context, timestamp, and non-sensitive metadata. Newest first, times in UK local time."
      />

      <AdminPanel className="p-0">
        <div className="border-b p-5">
          <SourceLabel>Source: audit_logs</SourceLabel>
        </div>
        <DataTable
          caption="Admin audit log readback"
          cardBreakpoint="xl"
          className="rounded-none border-0 shadow-none"
          mobileClassName="p-5"
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
          mobileCard={(log) => {
            const merchant = first(log.merchants)
            const customer = first(log.customers)
            return (
              <AdminRecordCard
                title={log.action}
                fields={[
                  {
                    label: "Actor",
                    value: <AuditActor log={log} />,
                  },
                  {
                    label: "Context",
                    value: (
                      <>
                        {merchant?.business_name ?? "No merchant"}
                        {customer
                          ? ` · ${maskAdminContact(
                              customer.email ?? customer.phone
                            )}`
                          : ""}
                      </>
                    ),
                  },
                  {
                    label: "Target",
                    value: <AuditTarget log={log} />,
                  },
                  {
                    label: "When",
                    mono: true,
                    value: (
                      <time dateTime={log.created_at}>
                        {formatAdminAuditDate(log.created_at)}
                      </time>
                    ),
                  },
                ]}
              />
            )
          }}
          columns={[
            {
              key: "action",
              header: "Action",
              cell: (log) => <span className="font-bold">{log.action}</span>,
            },
            {
              key: "actor",
              header: "Actor",
              cell: (log) => <AuditActor log={log} />,
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
              cell: (log) => <AuditTarget log={log} />,
            },
            {
              key: "when",
              header: "When",
              cell: (log) => (
                <time
                  className="text-muted-foreground"
                  dateTime={log.created_at}
                >
                  {formatAdminAuditDate(log.created_at)}
                </time>
              ),
            },
          ]}
        />
      </AdminPanel>
    </div>
  )
}

/**
 * Actor cell: type plus a copyable id chip when an actor id exists — no
 * truncated-with-no-recourse UUIDs, and no dangling separator when absent.
 */
function AuditActor({ log }: { readonly log: AdminAuditLog }) {
  if (!log.actor_id) {
    return <span>{log.actor_type}</span>
  }
  return <AdminIdChip value={log.actor_id} prefix={log.actor_type} />
}

/**
 * Target cell: `table:id` as a copyable chip; a target-less row prints just
 * the table name instead of the literal "table:undefined".
 */
function AuditTarget({ log }: { readonly log: AdminAuditLog }) {
  if (!log.target_id) {
    return <span className="font-mono text-xs">{log.target_table}</span>
  }
  return <AdminIdChip value={log.target_id} prefix={log.target_table} />
}
