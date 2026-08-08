import { SecurityCheckIcon } from "@hugeicons/core-free-icons"

import {
  AdminEmptyState,
  AdminPanel,
  AdminPanelFooter,
  AdminPanelHeader,
  SourceLabel,
  first,
  formatAdminAction,
  formatAdminAuditDate,
  maskAdminCustomer,
} from "@/components/admin/support"
import { AdminIdChip } from "@/components/admin/id-chip"
import {
  AdminAppliedFilters,
  AdminLookupControls,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { AdminRecordCard } from "@/components/admin/record-card"
import { PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminAuditPage } from "@/lib/admin/data"
import {
  buildLookupHref,
  parseAdminLookupParams,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

type AdminAuditPage = Awaited<ReturnType<typeof getAdminAuditPage>>
type AdminAuditLog = AdminAuditPage["rows"][number]

export const metadata = { title: "Admin — Audit logs" }

type AdminAuditPageProps = {
  searchParams?: Promise<AdminSearchParams>
}

export default async function AdminAuditPage({
  searchParams,
}: AdminAuditPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const lookup = parseAdminLookupParams(params)
  const logs = await getAdminAuditPage(lookup)
  const searching = Boolean(lookup.venue)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Audit logs"
        description="Actor, action, context, timestamp, and non-sensitive metadata. Newest first, times in UK local time."
      />

      <AdminPanel variant="flush">
        {/* Was a bare provenance pill in a 60px strip; the panel now carries
            the same eyebrow/title/description anatomy as its siblings, and
            the venue search + paginator the log always needed. */}
        <AdminPanelHeader>
          <SectionHeader
            title="Audit trail"
            description="Search by venue to answer questions about one merchant, and page through the whole trail rather than the newest hundred rows."
            actions={<SourceLabel>Source: audit_logs</SourceLabel>}
          />
          <AdminLookupControls
            basePath="/admin/audit"
            lookup={lookup}
            label="Audit log lookup"
            fields="venue"
          />
          <AdminAppliedFilters basePath="/admin/audit" lookup={lookup} />
        </AdminPanelHeader>
        <DataTable
          caption="Admin audit log readback"
          cardBreakpoint="xl"
          className="rounded-none border-0 shadow-none"
          mobileClassName="p-5"
          mobilePageSize={10}
          rows={logs.rows}
          getRowKey={(log) => log.id}
          emptyState={
            <AdminEmptyState
              icon={SecurityCheckIcon}
              title={
                searching ? "No matching audit entries" : "No audit logs yet"
              }
              description={
                searching
                  ? "No audited action is recorded against that venue. Clear the search to see the whole trail."
                  : "Audited support and security-sensitive actions will appear here."
              }
            />
          }
          mobileCard={(log) => {
            const merchant = first(log.merchants)
            const customer = first(log.customers)
            return (
              <AdminRecordCard
                title={formatAdminAction(log.action)}
                eyebrow={log.action}
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
                        {customer ? ` · ${maskAdminCustomer(customer)}` : ""}
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
              // Spoken name in the display face, exact key in mono beneath —
              // operators still need the raw token to grep for.
              cell: (log) => (
                <span className="grid gap-1">
                  <span className="font-bold">
                    {formatAdminAction(log.action)}
                  </span>
                  <span className="mono-id text-muted-foreground">
                    {log.action}
                  </span>
                </span>
              ),
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
                    {customer ? ` · ${maskAdminCustomer(customer)}` : ""}
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
        {logs.meta.total > 0 ? (
          <AdminPanelFooter className="pt-0">
            <AdminLookupPagination
              label="Audit log pages"
              unit="audited actions"
              meta={logs.meta}
              hrefForPage={(page) =>
                buildLookupHref("/admin/audit", {
                  venue: lookup.venue,
                  page,
                  size: lookup.size,
                })
              }
            />
          </AdminPanelFooter>
        ) : null}
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
