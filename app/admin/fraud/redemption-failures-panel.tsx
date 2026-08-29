import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminEmptyState,
  AdminPanel,
  SourceLabel,
  formatAdminDate,
} from "@/components/admin/support"
import {
  AdminAppliedFilters,
  AdminLookupControls,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import type { AdminRedemptionFailure } from "@/lib/admin/data"
import type {
  AdminLookupState,
  AdminPageMeta,
} from "@/lib/admin/lookup-query"

export function RedemptionFailuresPanel({
  failures,
  meta,
  lookup,
  view,
  hrefForPage,
}: {
  readonly failures: readonly AdminRedemptionFailure[]
  readonly meta: AdminPageMeta
  readonly lookup: AdminLookupState
  /** The active fraud view, carried through the search and filter links. */
  readonly view: string
  readonly hrefForPage: (page: number) => string
}) {
  const searching = Boolean(lookup.venue)

  return (
    <AdminPanel>
      <SectionHeader
        title="Redemption failures"
        description="Product-event failures retained for support analysis without exposing raw RPC payloads."
        actions={<SourceLabel>Source: product_events</SourceLabel>}
      />
      {/* Was the same hard newest-100 as the flags queue, with a truncation
          notice and a tab count that was the length of the loaded window — so
          "how often is this failing?" stopped counting at 100 (04#6). */}
      <AdminLookupControls
        sticky="padded"
        basePath="/admin/fraud"
        lookup={lookup}
        label="Redemption failure lookup"
        fields="venue"
        hiddenParams={{ queue: view }}
      />
      <AdminAppliedFilters
        basePath="/admin/fraud"
        lookup={lookup}
        extraParams={{ queue: view }}
      />
      <DataTable
        caption="Admin redemption failure event readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={[...failures]}
        getRowKey={(event) => event.id}
        emptyState={
          <AdminEmptyState
            icon={Cancel01Icon}
            title={
              searching
                ? "No matching redemption failures"
                : "No redemption failures yet"
            }
            description={
              searching
                ? "No recorded failure belongs to a venue whose name contains that fragment."
                : undefined
            }
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
            cell: (event) => event.merchant,
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
        mobileCard={(event) => (
          <AdminRecordCard
            title={event.event_name}
            fields={[
              { label: "Merchant", value: event.merchant },
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
        )}
      />
      {meta.total > 0 ? (
        <AdminLookupPagination
          label="Redemption failure pages"
          unit="recorded failures"
          meta={meta}
          hrefForPage={hrefForPage}
        />
      ) : null}
    </AdminPanel>
  )
}
