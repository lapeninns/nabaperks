import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminPanel,
  SourceLabel,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { EmptyState, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import type { getAdminFraudSignals } from "@/lib/admin/data"

type RedemptionFailures = Awaited<
  ReturnType<typeof getAdminFraudSignals>
>["failures"]

export function RedemptionFailuresPanel({
  failures,
}: {
  readonly failures: RedemptionFailures
}) {
  return (
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
        rows={failures}
        getRowKey={(event) => event.id}
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
