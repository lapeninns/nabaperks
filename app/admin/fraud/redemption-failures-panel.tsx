import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminEmptyState,
  AdminPanel,
  SourceLabel,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import type { getAdminFraudSignals } from "@/lib/admin/data"

type RedemptionFailures = Awaited<
  ReturnType<typeof getAdminFraudSignals>
>["failures"]

export function RedemptionFailuresPanel({
  failures,
  total,
}: {
  readonly failures: RedemptionFailures
  /** Server-side count, before the 100-row window. */
  readonly total?: number
}) {
  // Same 100-row window as the flags table, and until now the loader did not
  // even ask for a count — so a support question like "how often is this
  // failing?" was answered by a number that silently stopped at 100
  // (ADM 04#6).
  const truncated = typeof total === "number" && total > failures.length

  return (
    <AdminPanel>
      <SectionHeader
        title="Redemption failures"
        description="Product-event failures retained for support analysis without exposing raw RPC payloads."
        actions={<SourceLabel>Source: product_events</SourceLabel>}
      />
      {truncated ? (
        <p role="status" className="text-sm text-muted-foreground">
          Showing the newest{" "}
          <span className="numeric-tabular">{failures.length}</span> of{" "}
          <span className="numeric-tabular">{total}</span> recorded failures.
        </p>
      ) : null}
      <DataTable
        caption="Admin redemption failure event readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={failures}
        getRowKey={(event) => event.id}
        emptyState={
          <AdminEmptyState
            icon={Cancel01Icon}
            title="No redemption failures yet"
            padded={false}
          />
        }
        columns={[
          {
            key: "event",
            header: "Event",
            cell: (event) => (
              <span className="font-bold">{event.event_name}</span>
            ),
          },
          {
            key: "merchant",
            header: "Merchant",
            cell: (event) => {
              const merchant = first(event.merchants)
              return merchant?.business_name ?? "Merchant"
            },
          },
          {
            key: "when",
            header: "When",
            cell: (event) => (
              <time
                className="text-muted-foreground"
                dateTime={event.created_at}
              >
                {formatAdminDate(event.created_at)}
              </time>
            ),
          },
        ]}
        mobileCard={(event) => {
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
  )
}
