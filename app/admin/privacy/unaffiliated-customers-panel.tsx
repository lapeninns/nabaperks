import {
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { AdminIdChip } from "@/components/admin/id-chip"
import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminPanel,
  SourceLabel,
  StatusPill,
  formatAdminDate,
  maskAdminCustomer,
} from "@/components/admin/support"
import { EmptyState, SectionHeader } from "@/components/brand"
import type { getAdminUnaffiliatedCustomers } from "@/lib/admin/data"
import { Shield01Icon } from "@hugeicons/core-free-icons"

type UnaffiliatedResult = Awaited<
  ReturnType<typeof getAdminUnaffiliatedCustomers>
>
type UnaffiliatedRow = UnaffiliatedResult["rows"][number]

/**
 * Verified customers who never joined a venue (db privacy lifecycle). The
 * membership-based lookups above cannot surface them, so admins had no way to
 * discover or service a verified account with no membership. Reuses the page's
 * contact search; read-only, service-role readback.
 */
export function UnaffiliatedCustomersPanel({
  result,
  searching,
  hrefForPage,
}: {
  readonly result: UnaffiliatedResult | null
  readonly searching: boolean
  readonly hrefForPage: (page: number) => string
}) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Verified customers without a membership"
        description="Verified customers who signed up but never joined a venue — invisible to the membership lookups above. Filtered by the contact search at the top of the page."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      {result ? (
        result.rows.length ? (
          <>
            <div className="grid gap-3">
              {result.rows.map((row) => (
                <UnaffiliatedRecord key={row.id} row={row} />
              ))}
            </div>
            <AdminLookupPagination
              label="Unaffiliated customer pages"
              unit="customers"
              meta={result.meta}
              hrefForPage={hrefForPage}
            />
          </>
        ) : searching ? (
          <EmptyState
            icon={Shield01Icon}
            title="No matching customers"
            description="No unaffiliated customer matches that contact fragment."
            className="rounded-none border-0 p-0 shadow-none"
          />
        ) : (
          <EmptyState
            icon={Shield01Icon}
            title="No unaffiliated customers"
            description="Every verified customer has joined at least one venue."
            className="rounded-none border-0 p-0 shadow-none"
          />
        )
      ) : (
        <AdminLookupErrorState title="Unaffiliated lookup unavailable" />
      )}
    </AdminPanel>
  )
}

function UnaffiliatedRecord({ row }: { readonly row: UnaffiliatedRow }) {
  return (
    <AdminRecordCard
      title={maskAdminCustomer(row)}
      status={
        row.is_verified ? <StatusPill tone="good">Verified</StatusPill> : null
      }
      fields={[
        { label: "Signed up", value: formatAdminDate(row.created_at) },
        {
          label: "References",
          value: <AdminIdChip value={row.id} prefix="customer" />,
        },
      ]}
    />
  )
}
