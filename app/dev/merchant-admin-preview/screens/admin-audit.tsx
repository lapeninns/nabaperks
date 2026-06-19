import { SecurityCheckIcon } from "@hugeicons/core-free-icons"

import {
  AdminPanel,
  SourceLabel,
  first,
  formatAdminDate,
  maskAdminContact,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, PageTitle } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { ADMIN_AUDIT_LOGS, type AdminAuditRow } from "./mock-data"

/**
 * Mirror of `/admin/audit`. Reuses the real audit-log `DataTable` with
 * `maskAdminContact` masking and short-id formatting, exactly as the live page.
 */
export function AdminAuditScreen() {
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
          cardBreakpoint="lg"
          className="rounded-none border-0 shadow-none"
          rows={ADMIN_AUDIT_LOGS}
          getRowKey={(log: AdminAuditRow) => log.id}
          emptyState={
            <EmptyState
              icon={SecurityCheckIcon}
              title="No audit logs yet"
              description="Audited support and security-sensitive actions will appear here."
              className="rounded-none border-0 shadow-none"
            />
          }
          mobileCard={(log: AdminAuditRow) => {
            const merchant = first(log.merchants)
            const customer = first(log.customers)
            return (
              <AdminRecordCard
                title={log.action}
                fields={[
                  {
                    label: "Actor",
                    value: (
                      <>
                        {log.actor_type}
                        {log.actor_id ? `:${log.actor_id.slice(0, 8)}` : ""}
                      </>
                    ),
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
                    mono: true,
                    value: `${log.target_table}:${log.target_id?.slice(0, 8)}`,
                  },
                  {
                    label: "When",
                    mono: true,
                    value: (
                      <time dateTime={log.created_at}>
                        {formatAdminDate(log.created_at)}
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
              cell: (log: AdminAuditRow) => (
                <span className="font-bold">{log.action}</span>
              ),
            },
            {
              key: "actor",
              header: "Actor",
              cell: (log: AdminAuditRow) => (
                <span>
                  {log.actor_type}
                  {log.actor_id ? `:${log.actor_id.slice(0, 8)}` : ""}
                </span>
              ),
            },
            {
              key: "context",
              header: "Context",
              cell: (log: AdminAuditRow) => {
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
              cell: (log: AdminAuditRow) => (
                <span className="font-mono text-xs">
                  {log.target_table}:{log.target_id?.slice(0, 8)}
                </span>
              ),
            },
            {
              key: "when",
              header: "When",
              cell: (log: AdminAuditRow) => (
                <time
                  className="text-muted-foreground"
                  dateTime={log.created_at}
                >
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
