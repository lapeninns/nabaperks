import { AlertDiamondIcon, Cancel01Icon } from "@hugeicons/core-free-icons"

import {
  AdminPanel,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
  maskAdminContact,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import {
  ADMIN_FRAUD_FLAGS,
  ADMIN_REDEMPTION_FAILURES,
  type AdminFraudFlagRow,
  type AdminRedemptionFailureRow,
} from "./mock-data"

/**
 * Mirror of `/admin/fraud`. Reuses the real fraud-flag and redemption-failure
 * `DataTable`s with `maskAdminContact` masking and labelled signals.
 *
 * `empty` swaps both readbacks to `[]` so each `DataTable` renders its real
 * `EmptyState` (no broken table shell) — the empty-state preview variant.
 */
export function AdminFraudScreen({ empty = false }: { empty?: boolean }) {
  const fraudFlags = empty ? [] : ADMIN_FRAUD_FLAGS
  const redemptionFailures = empty ? [] : ADMIN_REDEMPTION_FAILURES

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Fraud"
        description="Fraud flags, soft geofence anomalies, and security-related product events."
      />

      <AdminPanel>
        <SectionHeader
          title="Fraud flags"
          description="Security support signals with masked customer context and labelled metadata."
          actions={
            <SourceLabel>Source: service-role admin readback</SourceLabel>
          }
        />
        <DataTable
          caption="Admin fraud flag readback"
          cardBreakpoint="xl"
          className="rounded-lg shadow-none"
          rows={fraudFlags}
          getRowKey={(flag: AdminFraudFlagRow) => flag.id}
          emptyState={
            <EmptyState
              icon={AlertDiamondIcon}
              title="No fraud flags yet"
              className="rounded-none border-0 p-0 shadow-none"
            />
          }
          columns={[
            {
              key: "signal",
              header: "Signal",
              cell: (flag: AdminFraudFlagRow) => (
                <span className="font-bold">
                  {flag.signal.replaceAll("_", " ")}
                </span>
              ),
            },
            {
              key: "context",
              header: "Context",
              cell: (flag: AdminFraudFlagRow) => {
                const merchant = first(flag.merchants)
                const customer = first(flag.customers)
                return (
                  <span className="text-muted-foreground">
                    {merchant?.business_name ?? "Merchant"}
                    {customer
                      ? ` · ${maskAdminContact(customer.email ?? customer.phone)}`
                      : ""}
                  </span>
                )
              },
            },
            {
              key: "severity",
              header: "Severity",
              cell: (flag: AdminFraudFlagRow) => (
                <StatusPill tone="warning">{flag.severity}</StatusPill>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (flag: AdminFraudFlagRow) => (
                <StatusPill>{flag.status}</StatusPill>
              ),
            },
            {
              key: "when",
              header: "When",
              cell: (flag: AdminFraudFlagRow) => (
                <time
                  className="text-muted-foreground"
                  dateTime={flag.created_at}
                >
                  {formatAdminDate(flag.created_at)}
                </time>
              ),
            },
          ]}
          mobileCard={(flag: AdminFraudFlagRow) => {
            const merchant = first(flag.merchants)
            const customer = first(flag.customers)
            return (
              <AdminRecordCard
                title={flag.signal.replaceAll("_", " ")}
                status={
                  <>
                    <StatusPill tone="warning">{flag.severity}</StatusPill>
                    <StatusPill>{flag.status}</StatusPill>
                  </>
                }
                fields={[
                  {
                    label: "Context",
                    value: (
                      <>
                        {merchant?.business_name ?? "Merchant"}
                        {customer
                          ? ` · ${maskAdminContact(customer.email ?? customer.phone)}`
                          : ""}
                      </>
                    ),
                  },
                  {
                    label: "When",
                    value: (
                      <time dateTime={flag.created_at}>
                        {formatAdminDate(flag.created_at)}
                      </time>
                    ),
                  },
                ]}
              />
            )
          }}
        />
      </AdminPanel>

      <AdminPanel>
        <SectionHeader
          title="Redemption failures"
          description="Product-event failures retained for support analysis without exposing raw RPC payloads."
          actions={<SourceLabel>Source: product_events</SourceLabel>}
        />
        <DataTable
          caption="Admin redemption failure event readback"
          cardBreakpoint="xl"
          className="rounded-lg shadow-none"
          rows={redemptionFailures}
          getRowKey={(event: AdminRedemptionFailureRow) => event.id}
          emptyState={
            <EmptyState
              icon={Cancel01Icon}
              title="No redemption failures yet"
              className="rounded-none border-0 p-0 shadow-none"
            />
          }
          columns={[
            {
              key: "event",
              header: "Event",
              cell: (event: AdminRedemptionFailureRow) => (
                <span className="font-bold">{event.event_name}</span>
              ),
            },
            {
              key: "merchant",
              header: "Merchant",
              cell: (event: AdminRedemptionFailureRow) => {
                const merchant = first(event.merchants)
                return merchant?.business_name ?? "Merchant"
              },
            },
            {
              key: "when",
              header: "When",
              cell: (event: AdminRedemptionFailureRow) => (
                <time
                  className="text-muted-foreground"
                  dateTime={event.created_at}
                >
                  {formatAdminDate(event.created_at)}
                </time>
              ),
            },
          ]}
          mobileCard={(event: AdminRedemptionFailureRow) => {
            const merchant = first(event.merchants)
            return (
              <AdminRecordCard
                title={event.event_name}
                fields={[
                  {
                    label: "Merchant",
                    value: merchant?.business_name ?? "Merchant",
                  },
                  {
                    label: "When",
                    value: (
                      <time dateTime={event.created_at}>
                        {formatAdminDate(event.created_at)}
                      </time>
                    ),
                  },
                ]}
              />
            )
          }}
        />
      </AdminPanel>
    </div>
  )
}
